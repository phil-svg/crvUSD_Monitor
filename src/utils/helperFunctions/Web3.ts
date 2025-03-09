import axios from 'axios';
import Bottleneck from 'bottleneck';
import axiosRetry from 'axios-retry';
import { web3HttpProvider } from '../web3/Web3Basics.js';

export async function getCallTraceViaRpcProvider(txHash: string): Promise<any> {
  const response = await fetch(process.env.WEB3_HTTP_MAINNET!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'trace_transaction',
      params: [txHash],
      id: 1,
      jsonrpc: '2.0',
    }),
  });

  if (response.status !== 200) {
    return 'request failed';
  }

  const data = (await response.json()) as { result: any };
  return data.result;
}

export async function getTxWithLimiter(txHash: string): Promise<any | null> {
  const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 300,
  });

  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      return retryCount * 2000;
    },
    retryCondition: (error) => {
      return error.code === 'ECONNABORTED' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT';
    },
  });

  return limiter.schedule(async () => {
    let retries = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 5000;

    while (retries < MAX_RETRIES) {
      try {
        const TX = await web3HttpProvider.eth.getTransaction(txHash);
        return TX;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const err = error as any;
          if (err.code === 'ECONNABORTED') {
            console.log(
              `getTxWithLimiter connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
                RETRY_DELAY / 1000
              } seconds.`
            );
          } else if (err.message && err.message.includes('CONNECTION ERROR')) {
            console.log(
              `getTxWithLimiter connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
                RETRY_DELAY / 1000
              } seconds.`
            );
          } else {
            console.log(
              `Failed to get transaction by hash. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${
                RETRY_DELAY / 1000
              } seconds.`
            );
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    console.log(
      `Failed to get transaction by hash ${txHash} after several attempts. Please check your connection and the status of the Ethereum node.`
    );
    return null;
  });
}
