import { web3HttpProvider } from './Web3Basics.js';

export interface EvmLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

const handlers: ((logs: EvmLogEntry[]) => void)[] = [];

export function registerHandler(handler: (logs: EvmLogEntry[]) => void) {
  handlers.push(handler);
}

export async function startListeningToAllEvents(): Promise<any> {
  try {
    let lastBlockNumber = await web3HttpProvider.eth.getBlockNumber();
    await getLogsForBlock(lastBlockNumber);

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 12 * 1000));

      try {
        const nextBlock = lastBlockNumber + 1;
        const validResponse = await getLogsForBlock(nextBlock);

        if (!validResponse) {
          console.warn('Invalid response, restarting listener...');
          return startListeningToAllEvents(); // Restart from scratch
        }

        lastBlockNumber = nextBlock; // Only increment if successful
      } catch (err) {
        console.error(`Failed to process block ${lastBlockNumber + 1}:`, err);
      }
    }
  } catch (err) {
    console.error('Critical failure in startListeningToAllEvents, restarting...', err);
    return startListeningToAllEvents(); // Restart on unexpected failure
  }
}

let lastSuccessBlock = 0;
export async function getLogsForBlock(blockNumber: number) {
  if (blockNumber === lastSuccessBlock) return true;
  const params = {
    fromBlock: blockNumber,
    toBlock: blockNumber,
  };
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const logs: EvmLogEntry[] = await web3HttpProvider.eth.getPastLogs(params);
      console.log(`Number of logs for block ${blockNumber}: ${logs.length}`);
      handlers.forEach((handler) => handler(logs));
      if (logs.length >= 1) lastSuccessBlock = blockNumber;
      return logs.length >= 1; // Success, exit the retry loop
    } catch (err) {
      retries++;
      if (retries >= maxRetries) {
        throw new Error(`Failed to get logs for block ${blockNumber} after ${maxRetries} retries`);
      }
      console.log(`Retrying block ${blockNumber}, attempt ${retries} of ${maxRetries}`);
      // Exponential backoff: wait longer with each retry (1s, 2s, 3s, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
    }
  }
}

export async function fetchEventsRealTime(
  evmEventLogs: EvmLogEntry[],
  contractAddress: string,
  abi: any[],
  eventName: string
) {
  let eventAbis: any[];

  if (eventName === 'AllEvents') {
    eventAbis = abi.filter((item) => item.type === 'event');
  } else {
    const eventAbi = abi.find((item) => item.type === 'event' && item.name === eventName);
    if (!eventAbi) {
      throw new Error(`Event ${eventName} not found in ABI`);
    }
    eventAbis = [eventAbi];
  }

  let allFormattedEvents: any[] = [];

  for (const eventAbi of eventAbis) {
    const eventSignature = web3HttpProvider.eth.abi.encodeEventSignature(eventAbi);

    const filteredLogs = evmEventLogs.filter(
      (log) => log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics[0] === eventSignature
    );

    const formattedEvents = filteredLogs.map((log) => {
      const decoded = web3HttpProvider.eth.abi.decodeLog(eventAbi.inputs!, log.data, log.topics.slice(1));

      const returnValues = Object.entries(decoded)
        .filter(([key]) => isNaN(Number(key)) && key !== '__length__')
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      return {
        address: log.address,
        event: eventAbi.name,
        returnValues,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        logIndex: log.logIndex,
        removed: log.removed,
      };
    });

    allFormattedEvents = allFormattedEvents.concat(formattedEvents);
  }

  return allFormattedEvents;
}
