import fs from 'fs';
import path from 'path';
import { ABI_AMM } from '../utils/abis/ABI_AMM.js';
import { web3Call, web3HttpProvider } from '../utils/web3/Web3Basics.js';
// you can find the amm and controller via curvemonitor -> copy address -> look up creation tx -> look up events
// ---------- ************ Coins************ ----------
const Address_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export async function studyGaps() {
    const endBlock = 23073144;
    const startBlock = endBlock - 5 * 60 * 24 * 7 * 12;
    const steps = 6000;
    const chunkSize = 5;
    //   const ammAddress = '0xEd325262f54b2987e74436f4556a27f748146da1'; // weETH
    //   const controllerAddress = '0x652aEa6B22310C89DCc506710CaD24d2Dba56B11'; // weETH
    const ammAddress = '0xE0438Eb3703bF871E31Ce639bd351109c88666ea'; // WBTC
    const controllerAddress = '0x4e59541306910aD6dC1daC0AC9dFB29bD9F15c67'; // WBTC
    const results = [];
    const blocks = Array.from({ length: steps }, (_, i) => Math.floor(startBlock + ((endBlock - startBlock) * i) / (steps - 1)));
    for (let i = 0; i < blocks.length; i += chunkSize) {
        const chunk = blocks.slice(i, i + chunkSize);
        const promises = chunk.map(async (blockNumber) => {
            const [activeRate, supposedRate, aaveBorrowRate] = await Promise.all([
                getActiveRate(ammAddress, blockNumber),
                getSupposeToBeRate(controllerAddress, blockNumber),
                getBorrowRateFromAave(Address_USDC, blockNumber),
            ]);
            const offByPercentage = Number((100 * (activeRate / supposedRate) - 100).toFixed(2));
            return {
                block: blockNumber,
                activeRate,
                supposedRate,
                offByPct: offByPercentage,
                aaveBorrowRate,
            };
        });
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
        console.log(`Processed ${Math.min(i + chunkSize, steps)} / ${steps}`);
    }
    const outputPath = path.resolve('src/results/study_gaps.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved to ${outputPath}`);
}
async function getBorrowRateFromAave(coinAddress, blockNumber) {
    const poolAddress = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'; // Aave v3 pool proxy
    const ABI = [
        {
            inputs: [{ internalType: 'address', name: 'asset', type: 'address' }],
            name: 'getReserveData',
            outputs: [
                {
                    components: [
                        {
                            components: [{ internalType: 'uint256', name: 'data', type: 'uint256' }],
                            internalType: 'struct DataTypes.ReserveConfigurationMap',
                            name: 'configuration',
                            type: 'tuple',
                        },
                        { internalType: 'uint128', name: 'liquidityIndex', type: 'uint128' },
                        { internalType: 'uint128', name: 'currentLiquidityRate', type: 'uint128' },
                        { internalType: 'uint128', name: 'variableBorrowIndex', type: 'uint128' },
                        { internalType: 'uint128', name: 'currentVariableBorrowRate', type: 'uint128' },
                        { internalType: 'uint128', name: 'currentStableBorrowRate', type: 'uint128' },
                        { internalType: 'uint40', name: 'lastUpdateTimestamp', type: 'uint40' },
                        { internalType: 'uint16', name: 'id', type: 'uint16' },
                        { internalType: 'address', name: 'aTokenAddress', type: 'address' },
                        { internalType: 'address', name: 'stableDebtTokenAddress', type: 'address' },
                        { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
                        { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
                        { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
                        { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
                        { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' },
                    ],
                    internalType: 'struct DataTypes.ReserveDataLegacy',
                    name: 'res',
                    type: 'tuple',
                },
            ],
            stateMutability: 'view',
            type: 'function',
        },
    ];
    const contract = new web3HttpProvider.eth.Contract(ABI, poolAddress);
    const reserveData = await web3Call(contract, 'getReserveData', [coinAddress], blockNumber);
    const ray = 1e27;
    const currentVariableBorrowRate = Number(reserveData.currentVariableBorrowRate);
    const apr = currentVariableBorrowRate / ray;
    return Number((apr * 100).toFixed(2));
}
async function getActiveRate(ammAddress, blockNumber) {
    const AMM_CONTRACT = new web3HttpProvider.eth.Contract(ABI_AMM, ammAddress);
    let rate = await web3Call(AMM_CONTRACT, 'rate', [], blockNumber);
    rate = (Math.pow(2.718281828459, (rate / 1e18) * 365 * 86400) - 1) * 100;
    return Number(rate.toFixed(2));
}
export async function getSupposeToBeRate(controllerAddress, blockNumber) {
    const ABI = [
        {
            stateMutability: 'view',
            type: 'function',
            name: 'rate',
            inputs: [{ name: '_for', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
        },
    ];
    const AggMonetaryPolicy = new web3HttpProvider.eth.Contract(ABI, '0x8d76f31e7c3b8f637131df15d9b4a3f8ba93bd75');
    let rate = await web3Call(AggMonetaryPolicy, 'rate', [controllerAddress], blockNumber);
    rate = (Math.pow(2.718281828459, (rate / 1e18) * 365 * 86400) - 1) * 100;
    return Number(rate.toFixed(2));
}
//# sourceMappingURL=GapFromRate.js.map