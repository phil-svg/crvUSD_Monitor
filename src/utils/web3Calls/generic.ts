import { Contract } from 'web3-eth-contract';
import { EventEmitter } from 'stream';
import { EnrichedLendingMarketEvent, TransactionReceipt } from '../Interfaces.js';
import { WEB3_HTTP_PROVIDER, WEB3_WS_PROVIDER } from '../web3connections.js';
import eventEmitter from '../EventEmitter.js';

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

export async function getCurrentBlockNumber(): Promise<number | null> {
  let shouldContinue = true;
  let retries = 0;
  const maxRetries = 12;
  let blockNumber: number | null = null;

  while (shouldContinue && retries < maxRetries && !blockNumber) {
    try {
      blockNumber = await WEB3_HTTP_PROVIDER.eth.getBlockNumber();
    } catch (error) {
      if (isError(error) && isCupsErr(error)) {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      } else {
        if (isError(error)) {
          console.log('Error in getCurrentBlockNumber', blockNumber, error.message);
        } else {
          console.log('Error in getCurrentBlockNumber', blockNumber, 'Unknown error');
        }
        shouldContinue = false;
      }
    }

    retries++;

    if (!blockNumber && shouldContinue) {
      await delay();
    }
  }

  return blockNumber;
}

export async function getCurrentBlockNumber2(): Promise<number | null> {
  let shouldContinue = true;
  let retries = 0;
  const maxRetries = 12;
  let blockNumber: number | null = null;

  while (shouldContinue && retries < maxRetries && !blockNumber) {
    try {
      blockNumber = await WEB3_WS_PROVIDER.eth.getBlockNumber();
    } catch (error) {
      if (isError(error) && isCupsErr(error)) {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      } else {
        if (isError(error)) {
          console.log('Error in getCurrentBlockNumber', blockNumber, error.message);
        } else {
          console.log('Error in getCurrentBlockNumber', blockNumber, 'Unknown error');
        }
        shouldContinue = false;
      }
    }

    retries++;

    if (!blockNumber && shouldContinue) {
      await delay();
    }
  }

  return blockNumber;
}

export async function getPastEvents(
  CONTRACT: Contract,
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

interface BlockNumber {
  block: string | number;
}

export async function web3Call(
  CONTRACT: Contract,
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

export async function getBlockTimeStamp(blockNumber: number): Promise<number> {
  const BLOCK = await WEB3_HTTP_PROVIDER.eth.getBlock(blockNumber);
  return Number(BLOCK.timestamp);
}

export async function subscribeToEvents(CONTRACT: any, Market: any) {
  try {
    const subscription = CONTRACT.events.allEvents();

    subscription
      .on('connected', () => {
        console.log(CONTRACT._address, `subscribed to events successfully`);
      })
      .on('data', async (eventData: any) => {
        console.log('New event in crvUSD Classic:', eventData.transactionHash);
        eventEmitter.emit('newEvent', { eventData, Market });
      })
      .on('error', (error: Error) => {
        console.error('Error in event subscription: ', error);
      });
  } catch (err: any) {
    console.log('Error in fetching events:', err.message);
  }
}

export async function subscribeToPegkeeperEvents(CONTRACT: any) {
  try {
    const subscription = CONTRACT.events.allEvents();

    subscription
      .on('connected', () => {
        console.log(CONTRACT._address, `subscribed to events successfully`);
      })
      .on('data', async (eventData: any) => {
        eventEmitter.emit('newPegKeeperEvent', eventData);
      })
      .on('error', (error: Error) => {
        console.error('Error in event subscription: ', error);
      });
  } catch (err: any) {
    console.log('Error in fetching events:', err.message);
  }
}

export async function subscribeToLendingMarketsEvents(
  market: EnrichedLendingMarketEvent,
  vaultContract: any,
  controllerContact: any,
  ammContract: any,
  eventEmitter: EventEmitter,
  type: 'Vault' | 'Controller' | 'Amm'
) {
  let contract: any;
  if (type === 'Vault') {
    contract = vaultContract;
  } else if (type === 'Controller') {
    contract = controllerContact;
  } else {
    contract = ammContract;
  }

  try {
    const subscription = contract.events.allEvents();

    subscription
      .on('connected', () => {
        console.log(contract._address, `subscribed to LLammaLend events successfully`);
      })
      .on('data', async (event: any) => {
        // console.log('LLAMMA LEND Event', event);
        eventEmitter.emit('newLendingMarketsEvent', {
          market,
          event,
          type,
          vaultContract,
          controllerContact,
          ammContract,
        });
      })
      .on('error', (error: Error) => {
        console.error('Error in event subscription: ', error);
      });
  } catch (err: any) {
    console.log('Error in fetching events:', err.message);
  }
}

export async function getTxFromTxHash(txHash: string): Promise<any | null> {
  try {
    const TX = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
    return TX;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getWalletTokenBalance(walletAddress: string, tokenAddress: string, blockNumber: number) {
  const ABI_BALANCE_OF: any[] = [
    {
      inputs: [
        {
          internalType: 'address',
          name: 'account',
          type: 'address',
        },
      ],
      name: 'balanceOf',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];
  const TOKEN = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_BALANCE_OF, tokenAddress);
  const BALANCE = await web3Call(TOKEN, 'balanceOf', [walletAddress], blockNumber);
  return BALANCE;
}

export async function checkWsConnectionViaNewBlocks(startTime = Date.now()): Promise<void> {
  const RETRY_INTERVAL_MS = 10000; // Retry every 10 seconds
  const MAX_RETRY_DURATION_MS = 120000; // Total retry duration of 2 minutes (120 seconds)
  const BLOCK_INTERVAL_TIMEOUT_MS = 30000; // 30 seconds to wait for a new block
  let blockTimeout: NodeJS.Timeout; // Define a timeout variable to track the 30-second interval

  // Function to reset/start the 30-second block watch timeout
  const resetBlockTimeout = () => {
    // Clear the existing timeout
    if (blockTimeout) clearTimeout(blockTimeout);

    // Set a new timeout
    blockTimeout = setTimeout(() => {
      console.log('No new block has been seen in the last 30 seconds');
    }, BLOCK_INTERVAL_TIMEOUT_MS);
  };

  try {
    // Initialize the block watch timeout
    resetBlockTimeout();

    // Subscribe to new block headers
    WEB3_WS_PROVIDER.eth
      .subscribe('newBlockHeaders', async (error, blockHeader) => {
        if (error) {
          console.error(`Error subscribing to new block headers: ${error}`);
          if (error.message.includes('connection not open')) {
            const currentTime = Date.now();
            if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
              console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
              setTimeout(() => checkWsConnectionViaNewBlocks(startTime), RETRY_INTERVAL_MS);
            } else {
              console.error('Failed to subscribe to new block headers after 2 minutes.');
            }
          }
          return;
        }

        // Resetting the 30-second timeout each time a new block is received
        resetBlockTimeout();

        if (blockHeader.number !== null) {
          const newBlockNumber = blockHeader.number;
          // console.log("New block number:", newBlockNumber);
        }
      })
      .on('error', console.error);
  } catch (err: any) {
    console.error(`An error occurred in subscribeToNewBlocks: ${err.message}`);
    const currentTime = Date.now();
    if (currentTime - startTime < MAX_RETRY_DURATION_MS) {
      console.log(`Retrying to subscribe in ${RETRY_INTERVAL_MS / 1000} seconds...`);
      setTimeout(() => checkWsConnectionViaNewBlocks(startTime), RETRY_INTERVAL_MS);
    } else {
      console.error('Failed to subscribe to new block headers after 2 minutes.');
    }
  }
}

export async function getTxReceiptClassic(txHash: string): Promise<TransactionReceipt | null> {
  try {
    let txReceipt = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
    return txReceipt;
  } catch (error: any) {
    console.error(`Failed to fetch transaction receipt for hash: ${txHash}. Error: ${error.message}`);
    return null;
  }
}
