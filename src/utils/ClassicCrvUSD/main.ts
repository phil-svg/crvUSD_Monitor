import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, appendFile, writeFile } from 'fs/promises';

import { EthereumEvent } from '../Interfaces.js';
import { getPastEvents, web3HttpProvider } from '../web3/Web3Basics.js';
import { ADDRESS_crvUSD_ControllerFactory } from '../Constants.js';
import { ABI_crvUSD_ControllerFactory } from '../abis/ABI_crvUSD_ControllerFactory.js';
import { handleLiveEvents, manageMarket, watchingForNewMarketOpenings } from '../Oragnizer.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../../../');

const CLASSIC_ADDMARKET_NDJSON = path.join(PROJECT_ROOT, 'classicAddMarketEvents.ndjson');
const LAST_SCANNED_CLASSIC_BLOCK_FILE = path.join(PROJECT_ROOT, 'lastScannedClassicCrvUSDBlock.json');

const CRVUSD_LAUNCH_BLOCK = 17257955;

// ─────────────────────────────────────────────────────────────
// Last scanned block (persistent)
// ─────────────────────────────────────────────────────────────
async function getLastScannedClassicBlock(): Promise<number> {
  try {
    const data = await readFile(LAST_SCANNED_CLASSIC_BLOCK_FILE, 'utf-8');
    const { lastScannedBlock } = JSON.parse(data);
    return typeof lastScannedBlock === 'number' ? lastScannedBlock : CRVUSD_LAUNCH_BLOCK - 1;
  } catch (err: any) {
    if (err.code === 'ENOENT') return CRVUSD_LAUNCH_BLOCK - 1;
    console.error('Error reading lastScannedClassicCrvUSDBlock.json:', err);
    return CRVUSD_LAUNCH_BLOCK - 1;
  }
}

async function saveLastScannedClassicBlock(blockNumber: number): Promise<void> {
  await writeFile(LAST_SCANNED_CLASSIC_BLOCK_FILE, JSON.stringify({ lastScannedBlock: blockNumber }, null, 2));
}

// ─────────────────────────────────────────────────────────────
// NDJSON helpers
// ─────────────────────────────────────────────────────────────
async function readClassicAddMarketEvents(): Promise<EthereumEvent[]> {
  try {
    const data = await readFile(CLASSIC_ADDMARKET_NDJSON, 'utf-8');
    return data
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    console.error('Error reading classicAddMarketEvents.ndjson:', err);
    return [];
  }
}

async function getPastEventsChunked(
  contract: any,
  eventName: string,
  fromBlock: number,
  toBlock: number
): Promise<EthereumEvent[]> {
  const events: EthereumEvent[] = [];
  const STEP = 999;

  for (let start = fromBlock; start <= toBlock; start += STEP) {
    const end = Math.min(start + STEP, toBlock);
    console.log(`Fetching AddMarket events ${start} → ${end} ...`);

    const chunk = await getPastEvents(contract, eventName, start, end);

    if (Array.isArray(chunk)) {
      events.push(...(chunk as EthereumEvent[]));

      if (chunk.length > 0) {
        const lines = chunk.map((e) => JSON.stringify(e)).join('\n') + '\n';
        await appendFile(CLASSIC_ADDMARKET_NDJSON, lines);
        console.log(`✅ Appended ${chunk.length} AddMarket events`);
      }
    } else {
      console.warn(`⚠️ getPastEvents returned non-array for blocks ${start}-${end}`);
    }
  }
  return events;
}

// ─────────────────────────────────────────────────────────────
// Main update logic
// ─────────────────────────────────────────────────────────────
async function updateClassicAddMarketEvents(currentBlockNumber: number) {
  const lastKnownBlock = await getLastScannedClassicBlock();

  if (lastKnownBlock >= currentBlockNumber) {
    console.log('✅ classicAddMarketEvents.ndjson is already up to date');
    return;
  }

  console.log(`Updating classic crvUSD markets — scanning new blocks ${lastKnownBlock + 1} → ${currentBlockNumber}`);

  const controllerFactory = new web3HttpProvider.eth.Contract(
    ABI_crvUSD_ControllerFactory,
    ADDRESS_crvUSD_ControllerFactory
  );

  await getPastEventsChunked(controllerFactory, 'AddMarket', lastKnownBlock + 1, currentBlockNumber);

  await saveLastScannedClassicBlock(currentBlockNumber);
}

// ─────────────────────────────────────────────────────────────
// Updated launch function
// ─────────────────────────────────────────────────────────────
export async function launchClassicCrvUSDMonitoring() {
  const currentBlockNumber = await web3HttpProvider.eth.getBlockNumber();
  console.log('currentBlockNumber (classic)', currentBlockNumber);

  await updateClassicAddMarketEvents(currentBlockNumber);

  // Load all markets we have stored
  const ADDED_MARKET_EVENTS = await readClassicAddMarketEvents();

  if (!(ADDED_MARKET_EVENTS instanceof Array)) return;

  for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
    await manageMarket(MARKET_CREATION);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await watchingForNewMarketOpenings(ADDRESS_crvUSD_ControllerFactory, ABI_crvUSD_ControllerFactory);
  await handleLiveEvents();

  console.log('crvUSD_Bot launched successfully.');
}
