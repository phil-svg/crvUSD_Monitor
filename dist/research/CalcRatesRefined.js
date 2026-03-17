import fs from 'fs';
import path from 'path';
import { getPastEvents, web3Call, web3HttpProvider } from '../utils/web3/Web3Basics.js';
import { getPegkeeperAddressArrOnchain, getSinglePegKeeperDebtAtBlocks } from '../utils/pegkeeper/Pegkeeper.js';
import { getcrvUSDinCirculation } from '../utils/helperFunctions/Decoding.js';
import { ABI_Controller } from '../utils/abis/ABI_Controller.js';
import { getSupposeToBeRate } from './GapFromRate.js';
// Constants
const TARGET_REMAINDER = 1e17; // rate is x1.9 when 10% left before ceiling
const MAX_RATE = 43959106799; // 300% APY
const DEBT_CANDLE_TIME = 43200; // 12 hours in seconds
const MIN_SIGMA = 1e14;
const MAX_SIGMA = 1e18;
const MAX_EXP = 1e21;
// Data storage for candles
let minDebtCandles = new Map();
// Function to fetch crvUSD price
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
async function getTotalControllerDebt(controllerAddress, blockNumber) {
    const contract = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
    const totalDebt = await web3Call(contract, 'total_debt', [], blockNumber);
    return totalDebt;
}
async function getAllControllerEvents(controllerAddress, fromBlock, toBlock) {
    const contract = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
    const events = await getPastEvents(contract, 'AllEvents', fromBlock, toBlock);
    return events;
}
// Function to fetch total debt
async function getTotalDebt(blockNumber, pegKeepersDebt) {
    const circulating = await getcrvUSDinCirculation(blockNumber);
    return Number((circulating + pegKeepersDebt).toFixed(0));
}
// Function to simulate rate calculation
async function calculateRateOld(crvUSDPrice, combinedPegKeepersDebt, totalDebt, debtFor, sigma, rate0, TARGET_FRACTION, ceiling, extraConst) {
    console.log('crvUSDPrice is:', 1000030013990445004, 'but ours:', crvUSDPrice); // seems correct!
    console.log('combinedPegKeepersDebt is:', 21244841, 'but ours:', combinedPegKeepersDebt); // seems correct!
    console.log('debtFor is:', 149718793772295079310002 / 1e18, 'but ours:', debtFor / 1e18); //
    // debtFor = 149718.79377229506 * 1e18; // 2078776479.2522984
    const debtFraction = combinedPegKeepersDebt / totalDebt;
    const priceComponent = (1.0 - crvUSDPrice) / sigma;
    const fractionComponent = debtFraction / TARGET_FRACTION;
    const power = priceComponent - fractionComponent;
    let rate = rate0 * Math.min(Math.exp(power), MAX_EXP) + extraConst;
    // let rate = rate0 * Math.exp(power);
    if (ceiling > 0) {
        const f = Math.min(debtFor / ceiling, 1e18 - TARGET_REMAINDER / 1000);
        console.log('hi', f); // 271241869142477100
        rate = Math.min((rate * (1e18 - TARGET_REMAINDER + (TARGET_REMAINDER * 1e18) / (1e18 - f))) / 1e18, MAX_RATE);
    }
    console.log('\nrate is:', 1914893979, 'but ours:', rate);
    const secondsPerYear = 365 * 86400;
    rate = Math.exp((rate / 1e18) * secondsPerYear) - 1;
    rate = Number((rate * 100).toFixed(8));
    return rate;
}
function readDebtCandle(controllerAddress, blockTimestamp) {
    const PERIOD = 12 * 60 * 60; // DEBT_CANDLE_TIME
    const candle = minDebtCandles.get(controllerAddress);
    if (!candle)
        return 0;
    const start = Math.floor(candle.timestamp / PERIOD) * PERIOD;
    if (blockTimestamp < start + PERIOD) {
        // still in the same bucket as the last update
        return Math.min(candle.candle0, candle.candle1);
    }
    else if (blockTimestamp < start + 2 * PERIOD) {
        // exactly the next bucket
        return candle.candle1;
    }
    else {
        // stale: skipped >= 2 buckets
        return 0;
    }
}
async function calculateRate(crvUSDPrice, combinedPegKeepersDebt, totalDebt, debtFor, sigma, rate0, TARGET_FRACTION, ceiling, extraConst) {
    // --- compare raw inputs to boa numbers ---
    console.log('σ (boa=7000000000000000) ours=', sigma, 'Δ=', sigma - 7000000000000000 / 1e18);
    console.log('target_debt_fraction (boa=200000000000000000) ours=', TARGET_FRACTION, 'Δ=', TARGET_FRACTION - 200000000000000000 / 1e18);
    console.log('p/oracle price (boa=1000030013990445004) ours=', crvUSDPrice, 'Δ=', crvUSDPrice - 1000030013990445004 / 1e18);
    console.log('pk_debt (boa=21244841933395073903775050) ours=', combinedPegKeepersDebt, 'Δ=', combinedPegKeepersDebt - 21244841933395073903775050 / 1e18);
    console.log('total_debt (boa=114236243857898339957395920) ours=', totalDebt, 'Δ=', totalDebt - 114236243857898339957395920 / 1e18);
    console.log('debt_for (boa=54249185164179016474395490) ours=', debtFor, 'Δ=', (debtFor - 54249185164179016474395490) / 1e18);
    console.log('ceiling (boa=200000000000000000000000000) ours=', ceiling, 'Δ=', ceiling - 200000000000000000000000000 / 1e18);
    console.log('rate0 (no boa ref here) =', rate0);
    console.log('extraConst (no boa ref here) =', extraConst);
    const debtFraction = combinedPegKeepersDebt / totalDebt;
    console.log('debtFraction (ours)=', debtFraction);
    const priceComponent = (1.0 - crvUSDPrice) / sigma;
    console.log('priceComponent (ours)=', priceComponent);
    const fractionComponent = debtFraction / TARGET_FRACTION;
    console.log('fractionComponent (ours)=', fractionComponent);
    const power = priceComponent - fractionComponent;
    console.log('power pre-PK (boa=-4287712920714858) ours=', power, 'Δ=', power - -4287712920714858);
    let rate = rate0 * Math.min(Math.exp(power), MAX_EXP) + extraConst;
    console.log('rate pre-ceiling (boa=1846178296) ours=', rate, 'Δ=', rate - 1846178296);
    if (ceiling > 0) {
        const f = Math.min(debtFor / ceiling, 1e18 - TARGET_REMAINDER / 1000);
        console.log('f (boa=271245925820895082) ours=', f, 'Δ=', f - 271245925820895082);
        rate = Math.min((rate * (1e18 - TARGET_REMAINDER + (TARGET_REMAINDER * 1e18) / (1e18 - f))) / 1e18, MAX_RATE);
    }
    console.log('rate final (boa=1914893979) ours=', rate, 'Δ=', rate - 1914893979);
    const secondsPerYear = 365 * 86400;
    rate = Math.exp((rate / 1e18) * secondsPerYear) - 1;
    rate = Number((rate * 100).toFixed(8));
    return rate;
}
function saveDebtCandle(controllerAddress, value, blockTimestamp) {
    const PERIOD = 12 * 60 * 60; // DEBT_CANDLE_TIME
    const candle = minDebtCandles.get(controllerAddress) || { candle0: 0, candle1: 0, timestamp: 0 };
    // Vyper: if never recorded AND value == 0 -> do nothing
    if (candle.timestamp === 0 && value === 0)
        return;
    // Align previous timestamp to its bucket start
    const start = Math.floor(candle.timestamp / PERIOD) * PERIOD;
    if (blockTimestamp >= start + PERIOD) {
        // We are in a new bucket relative to the last bucket start
        if (blockTimestamp < start + 2 * PERIOD) {
            // Exactly the next bucket: shift
            candle.candle0 = candle.candle1;
            candle.candle1 = value;
        }
        else {
            // Skipped >= 2 buckets: reset both to current value
            candle.candle0 = value;
            candle.candle1 = value;
        }
    }
    else {
        // Still within the same bucket: running minimum
        candle.candle1 = candle.candle1 === 0 ? value : Math.min(candle.candle1, value);
    }
    candle.timestamp = blockTimestamp;
    minDebtCandles.set(controllerAddress, candle);
}
async function prepareGenericJSON(endBlock, blocksPerDay, numDays) {
    const chunkSize = 2;
    const pegkeeperAddressArr = await getPegkeeperAddressArrOnchain(endBlock);
    const blocks = Array.from({ length: blocksPerDay * numDays }, (_, i) => endBlock - i);
    const results = [];
    for (let i = 0; i < blocks.length; i += chunkSize) {
        const chunk = blocks.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (blockNumber) => {
            // Fetch individual peg keeper debts
            const pegKeepersDebtPromises = pegkeeperAddressArr.map(async (pegKeeperAddress) => {
                const debt = await getSinglePegKeeperDebtAtBlocks(pegKeeperAddress, blockNumber);
                return { pegKeeperAddress: pegKeeperAddress, debt: debt || 0 }; // Fix here
            });
            const pegKeepersDebts = await Promise.all(pegKeepersDebtPromises);
            // Calculate combined debt
            const combinedPegKeepersDebt = pegKeepersDebts.reduce((total, pegKeeper) => total + pegKeeper.debt, 0);
            // Fetch crvUSD price and total debt
            const crvUSDPrice = await getCrvUSDPrice(blockNumber);
            const totalDebt = await getTotalDebt(blockNumber, combinedPegKeepersDebt);
            return {
                block: blockNumber,
                crvUSDPrice,
                pegKeepersDebt: pegKeepersDebts,
                combinedPegKeepersDebt,
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
async function prepareControllerDebtJson(controllerAddresses, endBlock, blocksPerDay, numDays) {
    const chunkSize = 2;
    const blocks = Array.from({ length: blocksPerDay * numDays }, (_, i) => endBlock - i).reverse(); // Reverse the block order
    const results = {};
    // Iterate over each controller address
    for (const controllerAddress of controllerAddresses) {
        let lastKnownDebt = 0; // Track the last known debt value
        let lastEventBlock = endBlock; // Track the block where we last updated debt
        // Fetch all events for the controller address once for the entire range
        const events = await getAllControllerEvents(controllerAddress, blocks[0], blocks[blocks.length - 1]); // Adjust event fetching to reflect the correct order
        if (events && Array.isArray(events)) {
            // Initialize debt for the first block (before processing events)
            const firstBlockDebt = await getTotalControllerDebt(controllerAddress, blocks[0]);
            lastKnownDebt = firstBlockDebt; // Set the debt for the first block
            // Iterate through each block and calculate the debt
            for (let i = 0; i < blocks.length; i += chunkSize) {
                const chunk = blocks.slice(i, i + chunkSize);
                const chunkResults = await Promise.all(chunk.map(async (blockNumber) => {
                    const eventInBlock = events.filter((event) => event.blockNumber === blockNumber);
                    // If events exist, we need to update the debt
                    if (eventInBlock.length > 0) {
                        const totalDebt = await getTotalControllerDebt(controllerAddress, blockNumber);
                        lastKnownDebt = totalDebt;
                        lastEventBlock = blockNumber;
                    }
                    // Store the debt in the results object under the block number
                    if (!results[blockNumber]) {
                        results[blockNumber] = [];
                    }
                    results[blockNumber].push({
                        controllerAddress,
                        debt: lastKnownDebt.toString(),
                    });
                    return {
                        block: blockNumber,
                        controllerAddress,
                        debt: lastKnownDebt.toString(),
                    };
                }));
                console.log(`Processed ${Math.min(i + chunkSize, blocks.length)} / ${blocks.length}`);
            }
        }
        else if (events && 'start' in events && 'end' in events) {
            console.log(`Events range from block ${events.start} to block ${events.end}`);
        }
        else {
            console.log(`No events found for controller: ${controllerAddress}`);
        }
    }
    // Save the results to a JSON file
    const outputPath = path.resolve('src/results/controller_debt_history.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved to ${outputPath}`);
}
// Function to read historical data from the saved JSON
async function readHistoricalData() {
    const pegkeeperDataPath = path.resolve('src/results/pegkeeper_history.json');
    const rawData = fs.readFileSync(pegkeeperDataPath, 'utf8');
    const pegkeeperData = JSON.parse(rawData);
    const controllerDataPath = path.resolve('src/results/controller_debt_history.json');
    const rawControllerData = fs.readFileSync(controllerDataPath, 'utf8');
    const controllerData = JSON.parse(rawControllerData);
    return { pegkeeperData, controllerData };
}
// Function to process and calculate rates for a series of blocks
async function processBlocks(sigma, ceiling, rate0, TARGET_FRACTION, endBlock, blocksPerDay, numDays, unixtimeEndBlock, // We are passing in the Unix timestamp of the endBlock
controllerAddress, extraConst) {
    var _a;
    const blockNumbers = Array.from({ length: blocksPerDay * numDays }, (_, i) => endBlock - i);
    blockNumbers.sort((a, b) => a - b);
    const results = [];
    const { pegkeeperData, controllerData } = await readHistoricalData(); // Read data from both JSON files
    for (let i = 0; i < blockNumbers.length; i++) {
        console.clear(); // <slfjgsölfkgjsdöflgkjsdöflgkjdsfölgkjsdöflgkjdsfölgkjsdfölgkjdsfölgkjdsfölkgjdsöflkgjdsölkgjsdölfkgjsödlfkgjösldfkgj
        const blockNumber = blockNumbers[i];
        // Find the data for the current block in the pegkeeperData
        let blockData = pegkeeperData.find((entry) => entry.block === blockNumber);
        // Calculate the block timestamp for the current block
        const blockTimestamp = unixtimeEndBlock - 12 * (endBlock - blockNumber); // Assuming 12 seconds per block
        // Check if the crvUSDPrice is missing and try to find the price from the previous or next block
        let crvUSDPrice = blockData.crvUSDPrice;
        if (crvUSDPrice === null || crvUSDPrice === undefined) {
            // Try to find the price from the previous block
            if (i > 0) {
                const previousBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i - 1]);
                crvUSDPrice = previousBlockData === null || previousBlockData === void 0 ? void 0 : previousBlockData.crvUSDPrice;
            }
            // If still no price, try to find the price from the next block
            if (crvUSDPrice === null || crvUSDPrice === undefined) {
                if (i < blockNumbers.length - 1) {
                    const nextBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i + 1]);
                    crvUSDPrice = nextBlockData === null || nextBlockData === void 0 ? void 0 : nextBlockData.crvUSDPrice;
                }
            }
        }
        // Handle pegKeepersDebt
        let { combinedPegKeepersDebt, totalDebt } = blockData;
        if (blockData.combinedPegKeepersDebt === 0) {
            // Try to find the pegKeepersDebt from the previous block
            const previousBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i - 1]);
            // Check if the previous block has valid pegKeepersDebt
            if (previousBlockData &&
                previousBlockData.pegKeepersDebt.length > 0 &&
                previousBlockData.combinedPegKeepersDebt !== 0) {
                blockData = previousBlockData;
                combinedPegKeepersDebt = blockData.combinedPegKeepersDebt;
                totalDebt = blockData.totalDebt;
            }
            // If still no debt, try to find the pegKeepersDebt from the next block
            if (blockData.combinedPegKeepersDebt === 0 && i < blockNumbers.length - 1) {
                const nextBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i + 1]);
                // Check if the next block has valid pegKeepersDebt
                if (nextBlockData && nextBlockData.pegKeepersDebt.length > 0 && nextBlockData.combinedPegKeepersDebt !== 0) {
                    blockData = nextBlockData;
                    combinedPegKeepersDebt = blockData.combinedPegKeepersDebt;
                    totalDebt = blockData.totalDebt;
                }
            }
        }
        // If still no debt (combinedPegKeepersDebt is 0), throw an error and stop
        if (blockData.combinedPegKeepersDebt === 0) {
            console.error(`Error: No valid pegKeepersDebt found for block ${blockNumber}, and no adjacent blocks have valid data.`);
            process.exit(1); // Crash the program
        }
        // Handle totalDebt
        if (totalDebt === null || totalDebt === undefined) {
            // Try to find totalDebt from the previous block
            if (i > 0) {
                const previousBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i - 1]);
                totalDebt = previousBlockData === null || previousBlockData === void 0 ? void 0 : previousBlockData.totalDebt;
            }
            // If still no totalDebt, try to find it from the next block
            if (totalDebt === null || totalDebt === undefined) {
                if (i < blockNumbers.length - 1) {
                    const nextBlockData = pegkeeperData.find((entry) => entry.block === blockNumbers[i + 1]);
                    totalDebt = nextBlockData === null || nextBlockData === void 0 ? void 0 : nextBlockData.totalDebt;
                }
            }
        }
        // If still no totalDebt, throw an error and stop
        if (totalDebt === null || totalDebt === undefined) {
            console.error(`Error: No totalDebt found for block ${blockNumber}, and no adjacent blocks have valid data.`);
            process.exit(1); // Crash the program
        }
        // Find the controller debt for the specific controller address
        const controllerDebtForBlock = controllerData[blockNumber]
            ? ((_a = controllerData[blockNumber].find((entry) => entry.controllerAddress.toLowerCase() === controllerAddress.toLowerCase())) === null || _a === void 0 ? void 0 : _a.debt) || 0
            : 0;
        // Save and read debt candles (simulate this for each block)
        saveDebtCandle(controllerAddress, controllerDebtForBlock, blockTimestamp);
        const currentDebt = readDebtCandle(controllerAddress, blockTimestamp);
        // Calculate the rate for this block
        const rate = await calculateRate(crvUSDPrice, combinedPegKeepersDebt, totalDebt, currentDebt, sigma, rate0, TARGET_FRACTION, ceiling, extraConst);
        // Store the results for this block
        results.push({
            block: blockNumber,
            rate,
        });
        console.log('final rate:', rate, 'correct one:', 6.22);
        if (blockNumber === 23071160) {
            console.log('hot');
            process.exit();
        }
    }
    // Save the results to a JSON file
    const outputPath = path.resolve('src/results/sim_rate_history.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} entries to ${outputPath}`);
}
async function readSimRateHistory() {
    const simRateDataPath = path.resolve('src/results/sim_rate_history.json');
    const rawData = fs.readFileSync(simRateDataPath, 'utf8');
    const simRateData = JSON.parse(rawData);
    return simRateData;
}
async function processSimAccuracyCheck(controllerAddress) {
    const simRateData = await readSimRateHistory(); // Read the sim_rate_history data
    const supposedRatesPath = path.resolve('src/results/supposedRates.json');
    const rawData = fs.readFileSync(supposedRatesPath, 'utf8');
    const supposedRateData = JSON.parse(rawData);
    const results = [];
    // Chunking the process to handle 5 blocks at a time
    const chunkSize = 5;
    // Iterate over the blocks in simRateData
    for (let i = 0; i < simRateData.length; i += chunkSize) {
        const chunk = simRateData.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (entry) => {
            const { block, rate: simRate } = entry;
            // Find the supposed rate for this block from the supposedRates data
            const supposedRateEntry = supposedRateData.find((entry) => entry.block === block);
            const supposedRate = supposedRateEntry ? supposedRateEntry.supposedRate : null;
            if (supposedRate === null) {
                console.error(`No supposedRate found for block ${block}`);
            }
            // Store the results
            results.push({
                block,
                simRate,
                supposedRate,
            });
            return {
                block,
                simRate,
                supposedRate,
            };
        }));
        console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(simRateData.length / chunkSize)}`);
    }
    // Save the results to simAccuracyCheck.json
    const outputPath = path.resolve('src/results/simAccuracyCheck.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} entries to ${outputPath}`);
}
async function saveSupposedRatesToJson(controllerAddress) {
    const simRateData = await readSimRateHistory(); // Read the sim_rate_history data
    const results = [];
    // Chunking the process to fetch 5 blocks at a time
    const chunkSize = 5;
    // Iterate over the blocks in simRateData
    for (let i = 0; i < simRateData.length; i += chunkSize) {
        const chunk = simRateData.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (entry) => {
            const { block } = entry;
            // Fetch the supposed rate for the block using your function
            const supposedRate = await getSupposeToBeRate(controllerAddress, block);
            // Store the results
            results.push({
                block,
                supposedRate,
            });
            return {
                block,
                supposedRate,
            };
        }));
        console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(simRateData.length / chunkSize)}`);
    }
    // Save the results to supposedRates.json
    const outputPath = path.resolve('src/results/supposedRates.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved ${results.length} entries to ${outputPath}`);
}
// Main function to execute the simulation
export async function calcRateAdvanced() {
    //   const ammAddress = '0xEd325262f54b2987e74436f4556a27f748146da1'; // weETH
    //   const controllerAddress = '0x652aEa6B22310C89DCc506710CaD24d2Dba56B11'; // weETH
    const ammAddress = '0xE0438Eb3703bF871E31Ce639bd351109c88666ea'; // WBTC
    const controllerAddress = '0x4e59541306910aD6dC1daC0AC9dFB29bD9F15c67'; // WBTC
    const endBlock = 23073144;
    const blocksPerDay = 7200;
    const numDays = 3;
    const block = await web3HttpProvider.eth.getBlock(endBlock);
    const unixtimeEndBlock = Number(block.timestamp);
    //   await prepareGenericJSON(endBlock, blocksPerDay, numDays); // <- required block, don't remove or edit this line at all
    //   process.exit(); // <- required block, don't remove or edit this line at all
    //   await prepareControllerDebtJson([controllerAddress], endBlock, blocksPerDay, numDays); // <- required block, don't remove or edit this line at all
    //   process.exit(); // <- required block, don't remove or edit this line at all
    //   await saveSupposedRatesToJson(controllerAddress); // <- required block, don't remove or edit this line at all
    //   process.exit(); // <- required block, don't remove or edit this line at all
    const sigma = 0.007;
    const ceiling = 200000000; // 200000000000000000000000000 => 200000000000000000000000000/1e18=200000000=200,000,000
    const rate0 = 3488077118;
    const TARGET_FRACTION = 0.2; // 200000000000000000 => 200000000000000000/1e18=0.2=20%
    const extraConst = 475646879;
    await processBlocks(sigma, ceiling, rate0, TARGET_FRACTION, endBlock, blocksPerDay, numDays, unixtimeEndBlock, controllerAddress, extraConst);
    // await processSimAccuracyCheck(controllerAddress);
}
/*

  {
    "block": 23071160,
    "simRate": 7.03558782,
    "supposedRate": 6.22
  }
  
  total_debt (boa=114,236,243) ours= 137,382,166
  
  //
*/
//# sourceMappingURL=CalcRatesRefined.js.map