export interface LendingMarketEventPayload {
  market: EnrichedLendingMarketEvent;
  event: any;
  type: 'Vault' | 'Controller' | 'Amm';
  vaultContract: any;
  controllerContact: any;
  ammContract: any;
}

export interface EthereumEvent {
  address: string;
  blockHash: string;
  blockNumber: number;
  logIndex: number;
  removed: boolean;
  transactionHash: string;
  transactionIndex: number;
  id: string;
  event: string;
  signature: string;
  returnValues: {
    [key: string]: any;
    user?: string;
    collateral_increase?: string;
    loan_increase?: string;
  };
  raw: {
    data: string;
    topics: string[];
  };
}

export interface LendingMarketEvent {
  id: string;
  collateral_token: string;
  borrowed_token: string;
  vault: string;
  controller: string;
  amm: string;
  price_oracle: string;
  monetary_policy: string;
}

export interface EnrichedLendingMarketEvent extends LendingMarketEvent {
  collateral_token_symbol: string;
  collateral_token_decimals: number;
  borrowed_token_symbol: string;
  borrowed_token_decimals: number;
  market_name: string;
  fee: number;
}
