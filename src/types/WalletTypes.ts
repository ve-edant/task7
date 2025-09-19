// src/types/WalletTypes.ts

export interface CoinWallet {
  id: string;
  geckoId: string;
  coinName: string;
  symbol: string;
  balance: number;
  currentPrice: number;
  dollarValue: number;
  change24h: number;
  image: string | null;
}

export interface WalletData {
  wallets: CoinWallet[];
  totalValue: number;
}

export interface CoinPriceData {
  [geckoId: string]: {
    usd: number;
    usd_24h_change: number;
  };
}