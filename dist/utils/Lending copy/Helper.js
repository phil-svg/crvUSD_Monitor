import { getCoinDecimals, getCoinSymbol } from '../pegkeeper/Pegkeeper.js';
import { web3Call, web3HttpProvider } from '../web3/Web3Basics.js';
import { ABI_LLAMALEND_AMM } from './Abis.js';
export function extractParsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation(receipt, market) {
    if (!receipt)
        return null;
    const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const controllerAddress = market.controller.toLowerCase().replace('0x', '');
    const ammAddress = market.amm.toLowerCase().replace('0x', '');
    const allLogsWithControllerAddress = receipt.logs.filter((log) => log.topics[0] === transferSignature &&
        log.topics[2].toLowerCase().replace('0x000000000000000000000000', '') === controllerAddress);
    const logEntry = allLogsWithControllerAddress.find((log) => log.topics[1].toLowerCase().replace('0x000000000000000000000000', '') !== ammAddress);
    if (logEntry) {
        const hexValue = logEntry.data;
        const relevantHexValue = hexValue.slice(2);
        const decimalValue = parseInt(relevantHexValue, 16);
        return decimalValue / 10 ** market.borrowed_token_decimals;
    }
    else {
        console.log('No matching log entry found.');
        return null;
    }
}
export function filterForOnly(targetAddress, market) {
    const normalizedTargetAddress = targetAddress.toLowerCase();
    const marketValues = Object.values(market);
    return marketValues.some((value) => {
        if (typeof value === 'string') {
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
    if (collateralTokenSymbol !== 'crvUSD') {
        return collateralTokenSymbol + ' Long';
    }
    else {
        return borrowedTokenSymbol + ' Short';
    }
}
export async function enrichMarketData(allLendingMarkets) {
    // Helper to split into chunks of max size 2
    const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };
    const marketChunks = chunkArray(allLendingMarkets, 2);
    const enrichedMarkets = [];
    // Process one chunk at a time → max 2 markets in parallel
    for (const chunk of marketChunks) {
        const chunkPromises = chunk.map(async (market) => {
            const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);
            // The 5 RPC calls **inside** each market still run in parallel
            const [collateralTokenSymbol, collateralTokenDecimals, borrowedTokenSymbol, borrowedTokenDecimals, feeRaw] = await Promise.all([
                getCoinSymbol(market.collateral_token, web3HttpProvider),
                getCoinDecimals(market.collateral_token, web3HttpProvider),
                getCoinSymbol(market.borrowed_token, web3HttpProvider),
                getCoinDecimals(market.borrowed_token, web3HttpProvider),
                web3Call(ammContract, 'fee', []),
            ]);
            if (!collateralTokenSymbol ||
                !borrowedTokenSymbol ||
                !collateralTokenDecimals ||
                !borrowedTokenDecimals ||
                !feeRaw) {
                return null;
            }
            const fee = feeRaw / 1e18;
            const collateralDecimals = parseInt(collateralTokenDecimals, 10);
            const borrowedDecimals = parseInt(borrowedTokenDecimals, 10);
            const marketName = buildMarketName(collateralTokenSymbol, borrowedTokenSymbol);
            return Object.assign(Object.assign({}, market), { collateral_token_symbol: collateralTokenSymbol, collateral_token_decimals: collateralDecimals, borrowed_token_symbol: borrowedTokenSymbol, borrowed_token_decimals: borrowedDecimals, market_name: marketName, fee: fee });
        });
        const chunkResults = await Promise.all(chunkPromises);
        // If any market in this chunk failed → whole function returns null (same as original)
        if (chunkResults.some((r) => r === null)) {
            return null;
        }
        enrichedMarkets.push(...chunkResults);
    }
    return enrichedMarkets;
}
export async function getFirstGaugeCrvApyByVaultAddress(vaultAddress) {
    var _a, _b, _c;
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
            if (((_a = item.lendingVaultAddress) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalizedInputAddress) {
                // Return the first number from gaugeCrvApy array
                return (_c = (_b = item.gaugeCrvApy) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : null;
            }
        }
        // If no matching lendingVaultAddress is found, return null
        return null;
    }
    catch (error) {
        console.error('Error fetching or processing data:', error);
        return null;
    }
}
//# sourceMappingURL=Helper.js.map