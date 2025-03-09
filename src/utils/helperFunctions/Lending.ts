import { EnrichedLendingMarketEvent } from '../Interfaces.js';
import { web3Call } from '../web3/Web3Basics.js';

export async function getBorrowApr(vaultContract: any, blockNumber: number) {
  const res = await web3Call(vaultContract, 'borrow_apr', [], blockNumber);
  return res / 1e16;
}

export async function getLendApr(vaultContract: any, blockNumber: number) {
  const res = await web3Call(vaultContract, 'lend_apr', [], blockNumber);
  return res / 1e16;
}

export async function getTotalAssets(market: EnrichedLendingMarketEvent, vaultContract: any, blockNumber: number) {
  const res = await web3Call(vaultContract, 'totalAssets', [], blockNumber);
  return res / 10 ** market.borrowed_token_decimals;
}

export async function getTotalDebtInMarket(
  market: EnrichedLendingMarketEvent,
  controllerContact: any,
  blockNumber: number
) {
  const res = await web3Call(controllerContact, 'total_debt', [], blockNumber);
  return res / 10 ** market.borrowed_token_decimals;
}

export async function getPositionHealth(controllerContact: any, user: string, blockNumber: number) {
  const res = await web3Call(controllerContact, 'health', [user], blockNumber);
  return res / 1e16;
}

export async function getCollatDollarValue(
  market: EnrichedLendingMarketEvent,
  ammContract: any,
  blockNumber: number
): Promise<number> {
  let res = await web3Call(ammContract, 'price_oracle', [], blockNumber);
  res = res / 1e18;
  const isLongPosition = market.market_name.endsWith('Long');

  if (isLongPosition) return res;
  return 1 / res;
}
