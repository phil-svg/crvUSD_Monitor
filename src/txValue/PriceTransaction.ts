import { getCurrentTokenPriceFromDefiLlama } from "./DefiLlama.js";

export interface CoinDetail {
  coin_id: number;
  amount: number;
  name: string;
  address: string;
}

export interface EnrichedTransactionDetail extends TransactionDetail {
  poolAddress: string;
  poolName: string;
  calledContractLabel: string;
  from: string;
  calledContractInceptionTimestamp: number;
  isCalledContractFromCurve: boolean;
}

export interface TransactionDetail {
  tx_id: number;
  pool_id: number;
  event_id?: number;
  tx_hash: string;
  block_number: number;
  block_unixtime: number;
  transaction_type: TransactionType;
  called_contract_by_user: string;
  trader: string;
  tx_position: number;
  coins_leaving_wallet: CoinDetail[];
  coins_entering_wallet: CoinDetail[];
}

export enum TransactionType {
  Swap = "swap",
  Deposit = "deposit",
  Remove = "remove",
}

export async function priceTransaction(enrichedTransaction: EnrichedTransactionDetail) {
  let coins: CoinDetail[];

  switch (enrichedTransaction.transaction_type) {
    case "swap":
      coins = [...enrichedTransaction.coins_leaving_wallet, ...enrichedTransaction.coins_entering_wallet];
      for (const coin of coins) {
        const price = await getCurrentTokenPriceFromDefiLlama(coin.address);
        if (price !== null) {
          return price * coin.amount; // Return as soon as we get a price.
        }
      }
      break;
    case "deposit":
    case "remove":
      coins = [...enrichedTransaction.coins_leaving_wallet, ...enrichedTransaction.coins_entering_wallet];
      let totalValue = 0;
      for (const coin of coins) {
        const price = await getCurrentTokenPriceFromDefiLlama(coin.address);
        if (price !== null) {
          totalValue += price * coin.amount;
        }
      }
      if (totalValue > 0) {
        return totalValue; // Return the total value of the coins.
      }
      break;
    default:
      console.log(`Unknown transaction type: ${enrichedTransaction.transaction_type}`);
      break;
  }

  return null; // Return null if no price could be fetched for any coin.
}
