import { dir } from "console";
import { EnrichedLendingMarketEvent, EthereumEvent, LendingMarketEvent } from "../Interfaces.js";
import { web3HttpProvider } from "../helperFunctions/Web3.js";
import { getCoinDecimals, getCoinSymbol } from "../pegkeeper/Pegkeeper.js";

export function filterForOnly(targetAddress: string, market: LendingMarketEvent): boolean {
  const normalizedTargetAddress = targetAddress.toLowerCase();
  const marketValues = Object.values(market);
  return marketValues.some((value) => value.toLowerCase() === normalizedTargetAddress);
}

export async function handleEvent(event: EthereumEvent): Promise<LendingMarketEvent> {
  const { id, collateral_token, borrowed_token, vault, controller, amm, price_oracle, monetary_policy } = event.returnValues;

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
  if (collateralTokenSymbol !== "crvUSD") {
    return collateralTokenSymbol + " Long";
  } else {
    return borrowedTokenSymbol + " Short";
  }
}

export async function enrichMarketData(allLendingMarkets: LendingMarketEvent[]): Promise<EnrichedLendingMarketEvent[] | null> {
  const enrichedMarkets: EnrichedLendingMarketEvent[] = [];

  for (const market of allLendingMarkets) {
    const collateralTokenSymbol = await getCoinSymbol(market.collateral_token, web3HttpProvider);
    const collateralTokenDecimals = await getCoinDecimals(market.collateral_token, web3HttpProvider);
    const borrowedTokenSymbol = await getCoinSymbol(market.borrowed_token, web3HttpProvider);
    const borrowedTokenDecimals = await getCoinDecimals(market.borrowed_token, web3HttpProvider);

    // Check if any fetched data is null
    if (!collateralTokenSymbol || !borrowedTokenSymbol || collateralTokenDecimals === null || borrowedTokenDecimals === null) {
      return null; // Return null for the whole function if any data couldn't be fetched
    }

    // Assuming decimals are returned as strings and need to be parsed
    const collateralDecimals = parseInt(collateralTokenDecimals, 10);
    const borrowedDecimals = parseInt(borrowedTokenDecimals, 10);

    const marketName = buildMarketName(collateralTokenSymbol, borrowedTokenSymbol);

    enrichedMarkets.push({
      ...market,
      collateral_token_symbol: collateralTokenSymbol,
      collateral_token_decimals: collateralDecimals,
      borrowed_token_symbol: borrowedTokenSymbol,
      borrowed_token_decimals: borrowedDecimals,
      market_name: marketName,
    });
  }

  return enrichedMarkets;
}
