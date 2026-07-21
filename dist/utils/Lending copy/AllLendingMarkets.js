import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, appendFile, writeFile } from 'fs/promises';
import { getPastEvents, web3HttpProvider } from '../web3/Web3Basics.js';
import { ABI_LLAMALEND_FACTORY } from './Abis.js';
import { llamalendFactoryAddress } from '../Constants.js';
import { handleEvent } from './Helper.js';
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../../../');
const LENDING_MARKETS_NDJSON = path.join(PROJECT_ROOT, 'lendingMarkets.ndjson');
const LAST_SCANNED_BLOCK_FILE = path.join(PROJECT_ROOT, 'lastScannedLendingBlock.json');
const LENDING_LAUNCH_BLOCK = 19415827;
// ─────────────────────────────────────────────────────────────
// Last scanned block persistence
// ─────────────────────────────────────────────────────────────
async function getLastScannedBlock() {
    try {
        const data = await readFile(LAST_SCANNED_BLOCK_FILE, 'utf-8');
        const { lastScannedBlock } = JSON.parse(data);
        return typeof lastScannedBlock === 'number' ? lastScannedBlock : LENDING_LAUNCH_BLOCK - 1;
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return LENDING_LAUNCH_BLOCK - 1;
        console.error('Error reading lastScannedLendingBlock.json:', err);
        return LENDING_LAUNCH_BLOCK - 1;
    }
}
async function saveLastScannedBlock(blockNumber) {
    await writeFile(LAST_SCANNED_BLOCK_FILE, JSON.stringify({ lastScannedBlock: blockNumber }, null, 2));
}
// ─────────────────────────────────────────────────────────────
// NDJSON helpers
// ─────────────────────────────────────────────────────────────
async function readLendingMarketsFromNDJSON() {
    try {
        const data = await readFile(LENDING_MARKETS_NDJSON, 'utf-8');
        return data
            .trim()
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => JSON.parse(line));
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            console.log('No lendingMarkets.ndjson found yet — will create one.');
            return [];
        }
        console.error('Error reading lendingMarkets.ndjson:', err);
        return [];
    }
}
async function getPastEventsChunked(contract, eventName, fromBlock, toBlock) {
    const events = [];
    const STEP = 999;
    for (let start = fromBlock; start <= toBlock; start += STEP) {
        const end = Math.min(start + STEP, toBlock);
        console.log(`Fetching NewVault events ${start} → ${end} ...`);
        const chunk = await getPastEvents(contract, eventName, start, end);
        if (Array.isArray(chunk)) {
            events.push(...chunk);
            if (chunk.length > 0) {
                const lines = chunk.map((e) => JSON.stringify(e)).join('\n') + '\n';
                await appendFile(LENDING_MARKETS_NDJSON, lines);
                console.log(`✅ Appended ${chunk.length} new events to lendingMarkets.ndjson`);
            }
        }
        else {
            console.warn(`⚠️ getPastEvents returned non-array for blocks ${start}-${end}`);
        }
    }
    return events;
}
// ─────────────────────────────────────────────────────────────
// Main update logic
// ─────────────────────────────────────────────────────────────
async function updateLendingMarketsJSON(currentBlockNumber) {
    const lastKnownBlock = await getLastScannedBlock();
    if (lastKnownBlock >= currentBlockNumber) {
        console.log('✅ lendingMarkets.ndjson is already up to date');
        return;
    }
    console.log(`Updating lending markets — scanning new blocks ${lastKnownBlock + 1} → ${currentBlockNumber}`);
    const llamalendFactory = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_FACTORY, llamalendFactoryAddress);
    await getPastEventsChunked(llamalendFactory, 'NewVault', lastKnownBlock + 1, currentBlockNumber);
    await saveLastScannedBlock(currentBlockNumber);
}
// ─────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────
export async function getAllLendingMarkets() {
    const currentBlockNumber = await web3HttpProvider.eth.getBlockNumber();
    await updateLendingMarketsJSON(currentBlockNumber);
    const events = await readLendingMarketsFromNDJSON();
    const lendingMarkets = await Promise.all(events.map((event) => handleEvent(event)));
    lendingMarkets.sort((a, b) => a.id.localeCompare(b.id));
    return lendingMarkets;
}
//# sourceMappingURL=AllLendingMarkets.js.map