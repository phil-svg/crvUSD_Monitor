import { getcrvUSDinCirculation } from '../utils/helperFunctions/Decoding.js';
import { getAllPegKeeperDebtAtBlock, getPegkeeperAddressArrOnchain } from '../utils/pegkeeper/Pegkeeper.js';
import { web3Call, web3HttpProvider } from '../utils/web3/Web3Basics.js';
import fs from 'fs';
import path from 'path';
export function calcRate() {
    const pegPrice = 1.0;
    const rate0Raw = 3488077118;
    const sigma = 0.007;
    const targetFraction = 0.2;
    const crvUSDPrice = 1.00002089;
    const pegKeepersDebt = 21260000;
    const totalDebt = 136940000;
    // Step 1: Compute DebtFraction
    const debtFraction = pegKeepersDebt / totalDebt;
    // Step 2: Compute power
    const priceComponent = (pegPrice - crvUSDPrice) / sigma;
    const fractionComponent = debtFraction / targetFraction;
    const power = priceComponent - fractionComponent;
    // Step 3: Convert rate0Raw to annualized APY
    const secondsPerYear = 365 * 86400;
    const rate0 = Math.exp((rate0Raw / 1e18) * secondsPerYear) - 1;
    // Step 4: Final rate
    const rate = rate0 * Math.exp(power);
    console.log('rate0', rate0);
    console.log('Math.exp(power)', Math.exp(power));
    // Output as percentage
    const result = rate * 100;
    console.log(`Resulting rate: ${result.toFixed(4)}%`);
    console.log('');
}
export async function calcRateAdvancedOld() {
    // await prepareJSON(); // <- required block, dont remove or edit this line at all
    // process.exit(); // <- required block, dont remove or edit this line at all
    // Load historical block data
    const dataPath = path.resolve('src/results/pegkeeper_history.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const parsed = JSON.parse(rawData);
    // ----- Hardcoded Inputs -----
    const pegPrice = 1.0;
    const rate0Raw = 3488077118;
    const sigma = 0.007;
    const targetFraction = 0.2;
    const secondsPerYear = 365 * 86400;
    const rate0 = Math.exp((rate0Raw / 1e18) * secondsPerYear) - 1;
    const results = [];
    for (const entry of parsed) {
        const { block, crvUSDPrice, pegKeepersDebt, totalDebt } = entry;
        const debtFraction = pegKeepersDebt / totalDebt;
        const priceComponent = (pegPrice - crvUSDPrice) / sigma;
        const fractionComponent = debtFraction / targetFraction;
        const power = priceComponent - fractionComponent;
        const rate = Number((rate0 * Math.exp(power) * 100).toFixed(4));
        results.push({
            block,
            rate,
        });
    }
    const outputPath = path.resolve('src/results/mintmarket_rates.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} entries to ${outputPath}`);
}
export async function prepareJSON() {
    const endBlock = 23073144;
    const blocksPerDay = 7200;
    const chunkSize = 2;
    const numDays = 7;
    const pegkeeperAddressArr = await getPegkeeperAddressArrOnchain(endBlock);
    const blocks = Array.from({ length: blocksPerDay * numDays }, (_, i) => endBlock - i);
    const results = [];
    for (let i = 0; i < blocks.length; i += chunkSize) {
        const chunk = blocks.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (blockNumber) => {
            const [crvUSDPrice, pegKeepersDebt] = await Promise.all([
                getCrvUSDPrice(blockNumber),
                getAllPegKeeperDebtAtBlock(pegkeeperAddressArr, blockNumber),
            ]);
            const totalDebt = await getTotalDebt(blockNumber, pegKeepersDebt);
            return {
                block: blockNumber,
                crvUSDPrice,
                pegKeepersDebt,
                totalDebt,
            };
        }));
        results.push(...chunkResults);
        console.log(`Processed ${Math.min(i + chunkSize, blocks.length)} / ${blocks.length}`);
    }
    const outputPath = path.resolve('src/results/pegkeeper_history.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved to ${outputPath}`);
}
async function getCrvUSDPrice(blockNumber) {
    const ABI = [
        {
            stateMutability: 'view',
            type: 'function',
            name: 'price',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
    ];
    const contract = new web3HttpProvider.eth.Contract(ABI, '0x18672b1b0c623a30089a280ed9256379fb0e4e62');
    const price = await web3Call(contract, 'price', [], blockNumber);
    return Number((price / 1e18).toFixed(12));
}
async function getTotalDebt(blockNumber, pegKeepersDebt) {
    const circulating = await getcrvUSDinCirculation(blockNumber);
    return Number((circulating + pegKeepersDebt).toFixed(0));
}
//# sourceMappingURL=CalcRate.js.map