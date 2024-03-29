import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {INFTToken, ISRC20Token} from "./token";

export declare interface ISign {
  pubkey: string;
  message: string;
  signature: string;
}

export declare interface IInscription {
  txId: string;
  blockHeight: string;
  state: "success" | "fail";
  tokenType: "BRC20";
  actionType: "deploy" | "mint" | "inscribeTransfer" | "transfer";
  fromAddress: string;
  toAddress: string;
  amount: string;
  token: string;
  inscriptionId: string;
  inscriptionNumber: string;
  index: string;
  location: string;
  msg: string;
  time: string;
}

export declare interface ISolana {
  signature: string;
  amount: string;
  address: string;
  timestamp: FieldValue | Timestamp;
}

export declare interface ITransaction {
  id: string;
  direction: "b2s" | "s2b";
  fromAddress: string;
  fromStatus: "confirmed";
  fromAmount: string;
  toAddress: string;
  toAmount: string;
  toStatus: "claiming" | "confirmed";
  bridgeFee: string;
  token: ISRC20Token & INFTToken;
  fromDetails?: IInscription;
  toDetails?: ISolana;
  fromTimestamp?: FieldValue | Timestamp;
  toTimestamp?: FieldValue | Timestamp;
  timestamp: FieldValue | Timestamp;
}

export declare interface IGetNFTRes {
  associatedTokenAddress: string;
  mint: string;
  name: string;
  symbol: string;
  collectionMintAddress?: string;
}
