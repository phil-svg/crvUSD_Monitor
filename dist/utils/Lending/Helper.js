import { web3HttpProvider } from "../helperFunctions/Web3.js";
import { getCoinDecimals, getCoinSymbol } from "../pegkeeper/Pegkeeper.js";
export function extractParsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation(receipt, market) {
    if (!receipt)
        return null;
    const transferSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const senderAddress = receipt.from.toLowerCase().replace("0x", "");
    const controllerAddress = market.controller.toLowerCase().replace("0x", "");
    const logEntry = receipt.logs.find((log) => log.topics[0] === transferSignature &&
        log.topics[1].toLowerCase().replace("0x000000000000000000000000", "") === senderAddress &&
        log.topics[2].toLowerCase().replace("0x000000000000000000000000", "") === controllerAddress);
    if (logEntry) {
        const hexValue = logEntry.data;
        const relevantHexValue = hexValue.slice(2);
        const decimalValue = parseInt(relevantHexValue, 16);
        return decimalValue / 10 ** market.borrowed_token_decimals;
    }
    else {
        console.log("No matching log entry found.");
        return null;
    }
}
export function filterForOnly(targetAddress, market) {
    const normalizedTargetAddress = targetAddress.toLowerCase();
    const marketValues = Object.values(market);
    return marketValues.some((value) => {
        if (typeof value === "string") {
            return value.toLowerCase() === normalizedTargetAddress;
        }
        return false;
    });
}
export async function handleEvent(event) {
    const { id, collateral_token, borrowed_token, vault, controller, amm, price_oracle, monetary_policy } = event.returnValues;
    const lendingMarketEvent = {
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
function buildMarketName(collateralTokenSymbol, borrowedTokenSymbol) {
    let token;
    if (collateralTokenSymbol !== "crvUSD") {
        return collateralTokenSymbol + " Long";
    }
    else {
        return borrowedTokenSymbol + " Short";
    }
}
export async function enrichMarketData(allLendingMarkets) {
    const enrichedMarkets = [];
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
        enrichedMarkets.push(Object.assign(Object.assign({}, market), { collateral_token_symbol: collateralTokenSymbol, collateral_token_decimals: collateralDecimals, borrowed_token_symbol: borrowedTokenSymbol, borrowed_token_decimals: borrowedDecimals, market_name: marketName }));
    }
    return enrichedMarkets;
}
//# sourceMappingURL=Helper.js.map