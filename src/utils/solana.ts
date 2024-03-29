import {decodeBase58} from "ethers";
import {mintTo, getOrCreateAssociatedTokenAccount} from "@solana/spl-token";
import {Connection, Keypair, PublicKey, TransactionSignature} from "@solana/web3.js";

export async function mint(
  toAddress: string,
  tokenAddress: string,
  mintAmount: number,
  privateKey: string,
  connection: Connection
): Promise<TransactionSignature> {
  console.log("mint", {toAddress, tokenAddress, mintAmount});

  // Payer of the transaction fees
  const payerPrivateHex = decodeBase58(privateKey).toString(16);
  const payer = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(payerPrivateHex, "hex")));
  const destination = new PublicKey(toAddress);
  const mint = new PublicKey(tokenAddress);

  // prepare token accounts
  let toTokenAccount: any = null;
  let retryTimes = 0;
  while (retryTimes < 3) {
    try {
      toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, destination);
      console.log("toTokenAccount:", toTokenAccount.address.toBase58());
      break;
    } catch (err) {
      console.warn("retryTimes", retryTimes, err);
      retryTimes++;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (toTokenAccount === null) throw new Error("create associated token account failed");

  await new Promise((r) => setTimeout(r, 2000));

  const signature = await mintTo(connection, payer, mint, toTokenAccount.address, payer.publicKey, mintAmount);
  console.log("tx:", `https://solscan.io/tx/${signature}`);

  return signature;
}
