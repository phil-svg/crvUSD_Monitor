import Web3 from "web3";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config({ path: "../.env" });

let web3WsProvider: Web3 | null = null;

export function getWeb3WsProvider(): Web3 {
  if (!web3WsProvider) {
    web3WsProvider = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS!));
  }
  return web3WsProvider;
}

let web3HttpProvider: Web3 | null = null;

export function getWeb3HttpProvider(): Web3 {
  if (!web3HttpProvider) {
    web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP!));
  }
  return web3HttpProvider;
}

export const ALCHEMY_KEY = process.env.WEB3_HTT!;

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
