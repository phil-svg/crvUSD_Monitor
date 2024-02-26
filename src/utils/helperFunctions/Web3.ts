import Web3 from "web3";
import dotenv from "dotenv";
import axios from "axios";
import Bottleneck from "bottleneck";
import axiosRetry from "axios-retry";
dotenv.config({ path: "../.env" });

export function getWeb3WsProvider(): Web3 {
  let web3WsProvider: Web3 | null = null;
  web3WsProvider = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS!));
  return web3WsProvider;
}

export function getWeb3HttpProvider(): Web3 {
  let web3HttpProvider: Web3 | null = null;
  web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP!));
  return web3HttpProvider;
}

export const ALCHEMY_KEY = process.env.WEB3_HTT!;

export const web3HttpProvider = getWeb3HttpProvider();
export const webWsProvider = getWeb3WsProvider();

export async function getTxReceipt(txHash: string): Promise<any> {
  try {
    const response = await axios.post(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY!}`,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
      },
      {
        timeout: 5000, // Set a timeout of 5000 milliseconds
      }
    );

    if (response.data && response.data.result) {
      return response.data.result;
    } else {
      return null;
    }
  } catch (error) {
    const err = error as Error & { code?: string };
    /*
    if (err.code !== "ECONNABORTED" && err.code !== "ERR_SOCKET_CONNECTION_TIMEOUT" && err.code !== "ERR_BAD_REQUEST") {
      // Don't log timeout errors
      console.error("Error fetching transaction receipt:", err);
    }
    */
    console.error("Error fetching transaction receipt:", err);
    return null;
  }
}

export async function getCallTraceViaAlchemy(txHash: string): Promise<any> {
  const API_KEY = process.env.ALCHEMY;
  const url = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "trace_transaction",
      params: [txHash],
      id: 1,
      jsonrpc: "2.0",
    }),
  });

  if (response.status !== 200) {
    return "request failed";
  }

  const data = (await response.json()) as { result: any };
  return data.result;
}

export async function getTxWithLimiter(txHash: string): Promise<any | null> {
  const web3 = getWeb3HttpProvider();
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
      return error.code === "ECONNABORTED" || error.code === "ERR_SOCKET_CONNECTION_TIMEOUT";
    },
  });

  return limiter.schedule(async () => {
    let retries = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 5000;

    while (retries < MAX_RETRIES) {
      try {
        const TX = await web3.eth.getTransaction(txHash);
        return TX;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const err = error as any;
          if (err.code === "ECONNABORTED") {
            console.log(`getTxWithLimiter connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else if (err.message && err.message.includes("CONNECTION ERROR")) {
            console.log(`getTxWithLimiter connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          } else {
            console.log(`Failed to get transaction by hash. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    console.log(`Failed to get transaction by hash ${txHash} after several attempts. Please check your connection and the status of the Ethereum node.`);
    return null;
  });
}
