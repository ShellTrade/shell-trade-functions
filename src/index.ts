import {PublicKey} from "@metaplex-foundation/umi";
import {Connection} from "@solana/web3.js";
import {parseUnits} from "ethers";
import {FieldValue} from "firebase-admin/firestore";
import {defineSecret, defineString} from "firebase-functions/params";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {ITransaction} from "./interfaces";
import {firestore, mint, SolInscribeService} from "./utils";

const locationId = defineString("LOCATION_ID");
const shellTradeDatabaseId = defineString("SHELL_TRADE_DATABASE_ID");
const rpcEndpoint = defineString("SOLANA_RPC_ENDPOINT");
const privateKeySrc20 = defineSecret("SOLANA_PAYER_PRIVATE_KEY");
const privateKeyNFT = defineSecret("SOLANA_NFT_PRIVATE_KEY");
const moralisApiKey = defineSecret("MORALIS_API_KEY");

// mint brc20 token on solana
export const shell_trade_claim_processor = onDocumentWritten(
  {
    region: locationId,
    document: "pendingtxs/{txId}",
    database: shellTradeDatabaseId as any,
    secrets: [privateKeySrc20, privateKeyNFT, moralisApiKey],
  },
  async () => {
    // TODO add filter to avoid repeated mint
    const pendingTxsCollectionRef = firestore.collection("pendingtxs");

    // skip if the previous transaction is still inprogress
    const pendingTxsSnapots = await pendingTxsCollectionRef.where("toStatus", "==", "inprogress").get();
    if (!pendingTxsSnapots.empty) return;

    // skip if there is no pending requests
    const pendingTxCollectionRef = firestore
      .collection("pendingtxs")
      .where("toStatus", "==", "pending")
      .orderBy("toTimestamp")
      .limit(1);
    const pendingTxCollectionDocs = await pendingTxCollectionRef.get();
    if (pendingTxCollectionDocs.empty) return;

    const transactionData = pendingTxCollectionDocs.docs[0].data() as ITransaction;
    console.log("transactionData", JSON.stringify(transactionData));

    // update status to inprogress to prevent the next transactions
    const txId = transactionData.id;
    const pendingTxRef = firestore.collection("pendingtxs").doc(txId);
    pendingTxRef.update({toStatus: "inprogress"});

    const {
      fromAddress,
      toAddress,
      toAmount,
      token: {
        decimals,
        address: tokenAddress,
        isNFT,
        collectionMintAddress,
        inscribeAmount,
        name,
        symbol,
        uri,
        inscription,
      },
    } = transactionData;

    const signatures: string[] = [];
    try {
      const connection = new Connection(rpcEndpoint.value(), "confirmed");

      if (!isNFT) {
        // mint token to target address on solana
        const signature = await mint(
          toAddress,
          tokenAddress as string,
          Number(parseUnits(toAmount, decimals).toString()),
          privateKeySrc20.value(),
          connection
        );
        signatures.push(signature);
      } else {
        const inscribeService = new SolInscribeService(privateKeyNFT.value(), rpcEndpoint.value());

        const nftRequiredNums = Number(toAmount) / Number(inscribeAmount);

        const nftOwnerAddress = (await inscribeService.getSigner()).toString();
        console.log({nftOwnerAddress});
        const nftOwned = await inscribeService.getNFTs({
          address: nftOwnerAddress,
          name,
          symbol,
          apiKey: moralisApiKey.value(),
          limit: nftRequiredNums,
        });
        const needMintNums = nftRequiredNums - nftOwned.length;
        console.log({nftRequiredNums, nftOwnedNums: nftOwned.length, needMintNums});

        if (needMintNums <= 0) {
          // nfts is enough, transfer to target wallet directly
          const targets: {nftMintAddress: string; targetWallet: string}[] = [];
          for (let i = 0; i < nftRequiredNums; i++) {
            const {mint} = nftOwned[i];
            targets.push({nftMintAddress: mint, targetWallet: toAddress});
          }

          const sign = await inscribeService.transferNFTBatch(targets, connection);
          if (!sign) throw new Error("batch transfer nft failed");

          signatures.push(sign);
        } else {
          // console.warn("nfts is insufficient, mint nft firstly");
          throw new Error("nfts is insufficient, please mint nft firstly");

          // TODO: should make sure nfts is enough since mint nft will take too much time
          // 1. nfts is insufficient, mint nft firstly
          for (let i = 0; i < needMintNums; i++) {
            const {mintAddress: nftMintAddress} = await inscribeService.createNFT({
              name,
              symbol,
              uri,
              collectionAddress: collectionMintAddress as PublicKey,
            });

            await new Promise((r) => setTimeout(r, 2000));

            await inscribeService.verifyCollection({
              nftMintAddress,
              collectionMintAddress: collectionMintAddress as PublicKey,
            });

            await new Promise((r) => setTimeout(r, 2000));

            await inscribeService.inscribe({nftMintAddress, inscription});

            await new Promise((r) => setTimeout(r, 2000));
          }

          const nftOwned = await inscribeService.getNFTs({
            address: nftOwnerAddress,
            name,
            symbol,
            apiKey: moralisApiKey.value(),
            limit: nftRequiredNums,
          });

          if (nftRequiredNums > nftOwned.length) throw new Error("insufficient nfts after minted");

          // 2. batch transfer nfts
          const targets: {nftMintAddress: string; targetWallet: string}[] = [];
          for (let i = 0; i < nftRequiredNums; i++) {
            const {mint} = nftOwned[i];
            targets.push({nftMintAddress: mint, targetWallet: toAddress});
          }

          const sign = await inscribeService.transferNFTBatch(targets, connection);
          if (!sign) throw new Error("batch transfer nft failed");

          signatures.push(sign as string);
        }
      }

      const transactionsRef = firestore.collection("accounts").doc(fromAddress).collection("transactions").doc(txId);
      await firestore.runTransaction(async (t) => {
        t.update(transactionsRef, {
          toStatus: "confirmed",
          toDetails: {
            signature: signatures,
            address: toAddress,
            amount: toAmount,
            timestamp: FieldValue.serverTimestamp(),
          },
        });

        t.delete(pendingTxRef);
      });
    } catch (err) {
      console.error("ERROR", err);
      await pendingTxRef.update({
        toStatus: "failed",
        toDetails: {
          signature: signatures,
          address: toAddress,
          amount: toAmount,
          timestamp: FieldValue.serverTimestamp(),
        },
      });
    }
  }
);
