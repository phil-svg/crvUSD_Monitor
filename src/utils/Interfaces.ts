export interface LendingMarketEventPayload {
  event: any;
  type: "Vault" | "Controller" | "Amm";
  contract: any;
  llamaLendVaultAddress: string;
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
    [key: string]: any; // This allows for flexibility in what returnValues can contain
    user?: string;
    collateral_increase?: string;
    loan_increase?: string;
  };
  raw: {
    data: string;
    topics: string[];
  };
}
