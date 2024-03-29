import supportTokens from "../constants/tokens.json";

export const supportTokenMetadata = supportTokens as Record<string, ISRC20Token | INFTToken>;

export declare interface ISRC20Token {
  isNFT: boolean;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
}

export declare interface INFTToken {
  isNFT: boolean;
  name: string;
  symbol: string;
  uri: string;
  inscription: string;
  inscribeAmount: number;
  maxInscribeAmount: number;
  collectionMintAddress: string;
}
