import Web3 from 'web3';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

export let web3HttpProvider = await getWeb3HttpProvider();
export let web3WsProvider = getWeb3WsProvider();

export function getWeb3WsProvider(): Web3 {
  let web3WsProvider: Web3 | null = null;
  const wsProvider = new Web3.providers.WebsocketProvider(process.env.WEB_WS_MAINNET!);

  // Attach 'end' event listener
  wsProvider.on('end', (err?: Error) => {
    console.log('WS connection ended, reconnecting...', err);
    web3WsProvider = null; // Clear instance so that it can be recreated.
    getWeb3WsProvider(); // Recursive call to recreate the provider.
  });

  wsProvider.on('error', () => {
    console.error('WS encountered an error');
  });

  web3WsProvider = new Web3(wsProvider);

  return web3WsProvider;
}

export async function getWeb3HttpProvider(): Promise<Web3> {
  let web3HttpProvider: Web3 | null = null;

  const MAX_RETRIES = 5; // Maximum number of retries
  const RETRY_DELAY = 5000; // Delay between retries in milliseconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP_MAINNET!));
      await web3HttpProvider.eth.net.isListening(); // This will throw an error if it can't connect
      return web3HttpProvider;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as any;
        if (err.code === 'ECONNABORTED') {
          console.log(
            `HTTP Provider connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
              RETRY_DELAY / 1000
            } seconds.`
          );
        } else if (err.message && err.message.includes('CONNECTION ERROR')) {
          console.log(
            `HTTP Provider connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
              RETRY_DELAY / 1000
            } seconds.`
          );
        } else {
          console.log(
            `Failed to connect to Node. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
              RETRY_DELAY / 1000
            } seconds.`
          );
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  throw new Error(
    'Failed to connect to Node after several attempts. Please check your connection and the status of the Node.'
  );
}

function isCupsErr(err: Error): boolean {
  return err.message.includes('compute units per second capacity');
}

function isError(err: unknown): err is Error {
  return err instanceof Error;
}

async function delay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 280));
}

async function randomDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
}

interface BlockNumber {
  block: string | number;
}

export async function web3Call(
  CONTRACT: any,
  method: string,
  params: any[],
  blockNumber: BlockNumber | number = { block: 'latest' }
): Promise<any> {
  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    try {
      return await CONTRACT.methods[method](...params).call(blockNumber);
    } catch (error) {
      if (isError(error) && !isCupsErr(error)) {
        console.log(
          `${error} | Contract: ${CONTRACT.options.address} | method: ${method} | params: ${params} | blockNumber: ${blockNumber}`
        );
        shouldContinue = false;
      } else {
        await randomDelay();
      }
    }
    retries++;
    if (shouldContinue) {
      await delay();
    }
  }
}

export async function getPastEvents(
  CONTRACT: any,
  eventName: string,
  fromBlock: number | null,
  toBlock: number | null
): Promise<Array<object> | { start: number; end: number } | null> {
  if (fromBlock === null || toBlock === null) {
    return null;
  }

  let retries = 0;
  const maxRetries = 12;
  let EVENT_ARRAY: Array<object> = [];

  while (retries < maxRetries) {
    try {
      const events = await CONTRACT.getPastEvents(eventName, { fromBlock, toBlock });
      for (const DATA of events) {
        EVENT_ARRAY.push(DATA);
      }
      break;
    } catch (error) {
      if (isError(error) && isCupsErr(error)) {
        await randomDelay();
      } else {
        const errorString = (error as Error).toString();
        if (errorString.includes('Log response size exceeded.')) {
          const matchResult = errorString.match(/\[.*\]/g);
          if (matchResult) {
            const recommendedBlockRange = matchResult[0];
            const [start, end] = recommendedBlockRange
              .slice(1, -1)
              .split(', ')
              .map((x: string) => parseInt(x, 16));
            return { start, end };
          }
        }
        throw error;
      }
    }

    retries++;

    if (EVENT_ARRAY.length === 0) {
      await delay();
    }
  }

  return EVENT_ARRAY;
}

export async function getPastEventsExtended(CONTRACT: any, eventName: string, fromBlock: number, toBlock: number) {
  let allEvents: any[] = [];
  let currentStartBlock = fromBlock;
  let currentEndBlock = toBlock;

  while (currentStartBlock < toBlock) {
    try {
      const borrowEvents = await getPastEvents(CONTRACT, eventName, currentStartBlock, currentEndBlock);

      if (Array.isArray(borrowEvents)) {
        allEvents = [...allEvents, ...borrowEvents];
        currentStartBlock = currentEndBlock + 1;
        currentEndBlock = toBlock;
      } else if (borrowEvents?.start && borrowEvents?.end) {
        currentStartBlock = borrowEvents.start;
        currentEndBlock = borrowEvents.end;
        continue;
      } else {
        throw new Error('Unexpected response from getPastEvents');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      break;
    }
  }

  return allEvents;
}

interface EventLog {
  event: string;
  address: string;
  returnValues: any;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: any[] };
}

interface Log {
  address: string;
  data: string;
  topics: string[];
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  removed: boolean;
}

export interface TransactionReceipt {
  status: boolean;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  from: string;
  to: string;
  contractAddress?: string;
  cumulativeGasUsed: number;
  gasUsed: number;
  effectiveGasPrice: number;
  logs: Log[];
  logsBloom: string;
  events?: {
    [eventName: string]: EventLog;
  };
}

export async function getTxReceiptClassic(txHash: string): Promise<TransactionReceipt | null> {
  try {
    let txReceipt = await web3HttpProvider.eth.getTransactionReceipt(txHash);
    return txReceipt;
  } catch (error: any) {
    console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
    return null;
  }
}

export async function getTxFromTxHash(txHash: string): Promise<any | null> {
  try {
    const TX = await web3HttpProvider.eth.getTransaction(txHash);
    return TX;
  } catch (err) {
    console.log(err);
    return null;
  }
}
