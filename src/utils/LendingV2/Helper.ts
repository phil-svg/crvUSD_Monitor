import { EnrichedLendingMarketEvent, EthereumEvent, LendingMarketEvent } from '../Interfaces.js';
import { getCoinDecimals, getCoinSymbol } from '../pegkeeper/Pegkeeper.js';
import { TransactionReceipt, web3Call, web3HttpProvider } from '../web3/Web3Basics.js';

import { ABI_LLAMALEND_AMM } from './Abis.js';

export function extractParsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation(
  receipt: TransactionReceipt | null,
  market: EnrichedLendingMarketEvent
): number | null {
  if (!receipt) return null;
  const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const controllerAddress = market.controller.toLowerCase().replace('0x', '');
  const ammAddress = market.amm.toLowerCase().replace('0x', '');

  const allLogsWithControllerAddress = receipt.logs.filter(
    (log) =>
      log.topics[0] === transferSignature &&
      log.topics[2].toLowerCase().replace('0x000000000000000000000000', '') === controllerAddress
  );

  const logEntry = allLogsWithControllerAddress.find(
    (log) => log.topics[1].toLowerCase().replace('0x000000000000000000000000', '') !== ammAddress
  );

  if (logEntry) {
    const hexValue = logEntry.data;
    const relevantHexValue = hexValue.slice(2);
    const decimalValue = parseInt(relevantHexValue, 16);
    return decimalValue / 10 ** market.borrowed_token_decimals;
  } else {
    console.log('No matching log entry found.');
    return null;
  }
}

export function filterForOnly(targetAddress: string, market: LendingMarketEvent): boolean {
  const normalizedTargetAddress = targetAddress.toLowerCase();
  const marketValues = Object.values(market);
  return marketValues.some((value) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === normalizedTargetAddress;
    }
    return false;
  });
}

export async function handleEvent(event: EthereumEvent): Promise<LendingMarketEvent> {
  const { id, collateral_token, borrowed_token, vault, controller, amm, price_oracle, monetary_policy } =
    event.returnValues;

  const lendingMarketEvent: LendingMarketEvent = {
    id,
    collateral_token,
    borrowed_token,
    vault,
    controller,
    amm,
    price_oracle,
    monetary_policy,
  };

  return lendingMarketEvent;
}

function buildMarketName(collateralTokenSymbol: string, borrowedTokenSymbol: string): string {
  let token;
  if (collateralTokenSymbol !== 'crvUSD') {
    return collateralTokenSymbol + ' Long';
  } else {
    return borrowedTokenSymbol + ' Short';
  }
}

export async function enrichMarketData(
  allLendingMarkets: LendingMarketEvent[]
): Promise<EnrichedLendingMarketEvent[] | null> {
  // Helper to split into chunks of max size 2
  const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const marketChunks = chunkArray(allLendingMarkets, 2);
  const enrichedMarkets: EnrichedLendingMarketEvent[] = [];

  // Process one chunk at a time → max 2 markets in parallel
  for (const chunk of marketChunks) {
    const chunkPromises = chunk.map(async (market) => {
      const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);

      // The 5 RPC calls **inside** each market still run in parallel
      const [collateralTokenSymbol, collateralTokenDecimals, borrowedTokenSymbol, borrowedTokenDecimals, feeRaw] =
        await Promise.all([
          getCoinSymbol(market.collateral_token, web3HttpProvider),
          getCoinDecimals(market.collateral_token, web3HttpProvider),
          getCoinSymbol(market.borrowed_token, web3HttpProvider),
          getCoinDecimals(market.borrowed_token, web3HttpProvider),
          web3Call(ammContract, 'fee', []),
        ]);

      if (
        !collateralTokenSymbol ||
        !borrowedTokenSymbol ||
        !collateralTokenDecimals ||
        !borrowedTokenDecimals ||
        !feeRaw
      ) {
        return null;
      }

      const fee = feeRaw / 1e18;
      const collateralDecimals = parseInt(collateralTokenDecimals, 10);
      const borrowedDecimals = parseInt(borrowedTokenDecimals, 10);
      const marketName = buildMarketName(collateralTokenSymbol, borrowedTokenSymbol);

      return {
        ...market,
        collateral_token_symbol: collateralTokenSymbol,
        collateral_token_decimals: collateralDecimals,
        borrowed_token_symbol: borrowedTokenSymbol,
        borrowed_token_decimals: borrowedDecimals,
        market_name: marketName,
        fee: fee,
      } as EnrichedLendingMarketEvent;
    });

    const chunkResults = await Promise.all(chunkPromises);

    // If any market in this chunk failed → whole function returns null (same as original)
    if (chunkResults.some((r) => r === null)) {
      return null;
    }

    enrichedMarkets.push(...(chunkResults as EnrichedLendingMarketEvent[]));
  }

  return enrichedMarkets;
}

export async function getFirstGaugeCrvApyByVaultAddress(vaultAddress: string): Promise<number | null> {
  // Normalize the input address to lower case for case-insensitive comparison
  const normalizedInputAddress = vaultAddress.toLowerCase();

  try {
    const rawResponse = await fetch('https://api.curve.finance/api/getAllGauges');
    if (!rawResponse.ok) {
      throw new Error('Network response was not ok');
    }

    const response = await rawResponse.json();

    // Search through each property in the data object
    for (const key in response.data) {
      const item = response.data[key];
      // Normalize the lendingVaultAddress to lower case
      if (item.lendingVaultAddress?.toLowerCase() === normalizedInputAddress) {
        // Return the first number from gaugeCrvApy array
        return item.gaugeCrvApy?.[0] ?? null;
      }
    }

    // If no matching lendingVaultAddress is found, return null
    return null;
  } catch (error) {
    console.error('Error fetching or processing data:', error);
    return null;
  }
}
