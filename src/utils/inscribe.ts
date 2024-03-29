import Moralis from "moralis";
import {decodeBase58, encodeBase58} from "ethers";
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import {generateSigner, keypairIdentity, percentAmount, PublicKey, Some} from "@metaplex-foundation/umi";
import {
  burnV1,
  createNft,
  fetchDigitalAsset,
  findMetadataPda,
  mplTokenMetadata,
  TokenStandard,
  transferV1,
  verifyCollectionV1,
  fetchAllDigitalAssetByOwner,
  fetchAllDigitalAssetByVerifiedCollection,
  Collection,
} from "@metaplex-foundation/mpl-token-metadata";

import {
  fetchInscriptionMetadata,
  findInscriptionMetadataPda,
  findMintInscriptionPda,
  initializeFromMint,
  writeData,
} from "@metaplex-foundation/mpl-inscription";
import {Connection, Keypair, PublicKey as PublicKeyWeb3, sendAndConfirmTransaction, Transaction} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {IGetNFTRes, INFTToken, supportTokenMetadata} from "../interfaces";
import {sleep} from "./sleep";

export class SolInscribeService {
  private umi;
  private signWallet;

  constructor(privateKey: string, endpoint: string) {
    this.umi = createUmi(endpoint).use(mplTokenMetadata());
    this.signWallet = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(decodeBase58(privateKey).toString(16), "hex")));

    const signer = this.umi.eddsa.createKeypairFromSecretKey(
      Uint8Array.from(Buffer.from(decodeBase58(privateKey).toString(16), "hex"))
    );
    this.umi.use(keypairIdentity(signer));
  }

  public async getSigner() {
    return this.umi.payer.publicKey;
  }

  public async createNFTCollection(params: {name: string; symbol: string; uri: string}) {
    console.log("createNFTCollection params", params);
    const {name, symbol, uri} = params;
    const collectionMintSigner = generateSigner(this.umi);

    const {signature} = await createNft(this.umi, {
      mint: collectionMintSigner,
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: percentAmount(0),
      isMutable: false,
      isCollection: true,
    }).sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("createNFTCollection success.", `https://solscan.io/tx/${signatureString}`);

    return {
      mintAddress: collectionMintSigner.publicKey,
      signature: signatureString,
    };
  }

  public async createNFT(params: {name: string; symbol: string; uri: string; collectionAddress: PublicKey}) {
    console.log("createNFT params", params);
    const {name, symbol, uri, collectionAddress} = params;
    const nftMintSigner = generateSigner(this.umi);

    const {signature} = await createNft(this.umi, {
      mint: nftMintSigner,
      name,
      symbol,
      uri,
      isMutable: false,
      collection: {
        verified: false,
        key: collectionAddress,
      },
      sellerFeeBasisPoints: percentAmount(0),
    }).sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("createNFT success.", `https://solscan.io/tx/${signatureString}`);

    return {mintAddress: nftMintSigner.publicKey, signature: signatureString};
  }

  public async verifyCollection(params: {nftMintAddress: PublicKey; collectionMintAddress: PublicKey}) {
    console.log("verifyCollection params", params);
    const {nftMintAddress, collectionMintAddress} = params;

    const nftMetadata = findMetadataPda(this.umi, {
      mint: nftMintAddress,
    });

    const {signature} = await verifyCollectionV1(this.umi, {
      metadata: nftMetadata,
      collectionMint: collectionMintAddress,
    }).sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("verifyCollection success.", `https://solscan.io/tx/${signatureString}`);
    return signatureString;
  }

  public async transferNFT(params: {nftMintAddress: PublicKey; destinationOwner: PublicKey}) {
    console.log("transferNFT params", params);

    const {nftMintAddress, destinationOwner} = params;

    const {signature} = await transferV1(this.umi, {
      mint: nftMintAddress,
      authority: this.umi.payer,
      tokenOwner: this.umi.payer.publicKey,
      destinationOwner,
      tokenStandard: TokenStandard.NonFungible,
    }).sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("transferNFT success.", `https://solscan.io/tx/${signatureString}`);
    return signatureString;
  }

  public async burnNFT(params: {nftMintAddress: PublicKey; collectionMintAddress?: PublicKey}) {
    console.log("burnNFT params", params);
    const {nftMintAddress, collectionMintAddress} = params;

    const collectionMetadata = collectionMintAddress
      ? findMetadataPda(this.umi, {mint: collectionMintAddress})
      : undefined;

    const {signature} = await burnV1(this.umi, {
      mint: nftMintAddress,
      authority: this.umi.payer,
      tokenOwner: this.umi.payer.publicKey,
      tokenStandard: TokenStandard.NonFungible,
      collectionMetadata,
    }).sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("burnNFT success.", `https://solscan.io/tx/${signatureString}`);
    return signatureString;
  }

  public async inscribe(params: {nftMintAddress: PublicKey; inscription: string}) {
    console.log("inscribe params", params);
    const {nftMintAddress, inscription} = params;

    const inscriptionAccount = findMintInscriptionPda(this.umi, {
      mint: nftMintAddress,
    });
    const inscriptionMetadataAccount = findInscriptionMetadataPda(this.umi, {
      inscriptionAccount: inscriptionAccount[0],
    });

    const {signature} = await initializeFromMint(this.umi, {
      mintAccount: nftMintAddress,
    })
      .add(
        writeData(this.umi, {
          inscriptionAccount,
          inscriptionMetadataAccount,
          value: Buffer.from(inscription),
          associatedTag: null,
          offset: 0,
        })
      )
      .sendAndConfirm(this.umi);

    const signatureString = encodeBase58(signature);
    console.log("inscribe success.", `https://solscan.io/tx/${signatureString}`);

    const inscriptionMetadata = await fetchInscriptionMetadata(this.umi, inscriptionMetadataAccount);
    console.log("Inscription Number: ", inscriptionMetadata.inscriptionRank.toString());

    return signatureString;
  }

  public async fetchNFT(mintAddress: PublicKey) {
    return await fetchDigitalAsset(this.umi, mintAddress);
  }

  public async fetchAllDigitalAssetByOwner(owner: PublicKey) {
    return await fetchAllDigitalAssetByOwner(this.umi, owner);
  }

  public async fetchAllDigitalAssetByVerifiedCollection(collectionAddress: PublicKey) {
    return await fetchAllDigitalAssetByVerifiedCollection(this.umi, collectionAddress);
  }

  public async getNFTs({
    address,
    name,
    symbol,
    apiKey,
    limit = 10,
  }: {
    address: string;
    name: string;
    symbol: string;
    apiKey: string;
    limit: number;
  }) {
    if (!Moralis.Core.isStarted) {
      await Moralis.start({apiKey});
    }

    const response = await Moralis.SolApi.account.getNFTs({address});
    const nfts: IGetNFTRes[] = response.raw;

    const supportCollections = Object.values(supportTokenMetadata)
      .filter((item: any) => item.collectionMintAddress !== undefined)
      .map((item) => (item as INFTToken).collectionMintAddress);

    const results: IGetNFTRes[] = [];
    for (let i = 0; i < nfts.length; i++) {
      if (nfts[i].name === name && nfts[i].symbol === symbol) {
        const collection = await fetchDigitalAsset(this.umi, nfts[i].mint as PublicKey).then((res) => {
          return res.metadata.collection as Some<Collection>;
        });

        if (
          collection &&
          collection.value &&
          collection.value.verified &&
          supportCollections.includes(collection.value.key.toString())
        ) {
          results.push({
            ...nfts[i],
            collectionMintAddress: collection.value.key.toString(),
          });
          if (results.length === limit) break;
        }
        await sleep(500);
      }
    }

    return results;
  }

  public async transferNFTBatch(
    params: {
      nftMintAddress: string;
      targetWallet: string;
    }[],
    connection: Connection
  ) {
    // prepare token accounts
    const transactions = new Transaction();
    for (let i = 0; i < params.length; i++) {
      const {nftMintAddress, targetWallet} = params[i];
      const nftMint = new PublicKeyWeb3(nftMintAddress);
      const toWalletPublicKey = new PublicKeyWeb3(targetWallet);

      const fromTokenAccountAddress = getAssociatedTokenAddressSync(nftMint, this.signWallet.publicKey);
      // const toTokenAccountAddress = getAssociatedTokenAddressSync(nftMint, toWalletPublicKey);

      // prepare to token accounts
      let toTokenAccount: any = null;
      let retryTimes = 0;
      while (retryTimes < 5) {
        try {
          toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            this.signWallet,
            nftMint,
            toWalletPublicKey
          );
          console.log("toTokenAccountAddress", toTokenAccount.address.toBase58());
          break;
        } catch (err) {
          console.warn("retryTimes-getOrCreateAssociatedTokenAccount", retryTimes, err);
          retryTimes++;
          await sleep(10000);
        }
      }

      if (toTokenAccount === null) throw new Error("create associated nft token account failed");

      transactions.add(
        createTransferInstruction(
          fromTokenAccountAddress,
          toTokenAccount.address,
          this.signWallet.publicKey,
          1,
          [this.signWallet],
          TOKEN_PROGRAM_ID
        )
      );
    }

    await sleep(5000);

    let retryTimes = 0;
    while (retryTimes < 5) {
      try {
        const signature = await sendAndConfirmTransaction(connection, transactions, [this.signWallet]);
        console.log("tx:", `https://solscan.io/tx/${signature}`);
        return signature;
      } catch (err) {
        console.warn("retryTimes-sendAndConfirmTransaction", retryTimes, err);
        retryTimes++;
        await sleep(10000);
      }
    }

    return;
  }
}
