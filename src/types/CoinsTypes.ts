export type CoinListItem = {
  id: string;
  coin_id: number;
  name: string;
  symbol: string;
  market_cap_rank: number;
  image?: string;
  thumb: string;
  small: string;
  large: string;
  slug: string;
  price_btc: number;
  score: number;
  data?: {
    price: number;
    price_btc: string;
    market_cap: string;
    market_cap_btc: string;
    total_volume: string;
    total_volume_btc: string;
    sparkline: string;
    content?: {
      title?: string;
      description?: string;
    } | null;
    price_change_percentage_24h?: Record<string, number>;
  };
}; 


// types/coin.ts
export interface CoinImage {
  thumb: string;
  small: string;
  large: string;
}

export interface CoinLinks {
  homepage: string[];
  blockchain_site: string[];
  twitter_screen_name?: string;
}

export interface MarketData {
  market_cap?: {
    usd?: number;
  };
  circulating_supply?: number;
  total_supply?: number;
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  asset_platform_id?: string | null;
  contract_address?: string;
  image: CoinImage;
  links: CoinLinks;
  market_data?: MarketData;
}
