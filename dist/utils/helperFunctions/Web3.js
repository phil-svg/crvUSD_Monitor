import Web3 from "web3";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config({ path: "../.env" });
let web3WsProvider = null;
export function getWeb3WsProvider() {
    if (!web3WsProvider) {
        web3WsProvider = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS));
    }
    return web3WsProvider;
}
let web3HttpProvider = null;
export function getWeb3HttpProvider() {
    if (!web3HttpProvider) {
        web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP));
    }
    return web3HttpProvider;
}
export const ALCHEMY_KEY = process.env.WEB3_HTT;
export async function getTxReceipt(txHash) {
    try {
        const response = await axios.post(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`, {
            id: 1,
            jsonrpc: "2.0",
            method: "eth_getTransactionReceipt",
            params: [txHash],
        }, {
            timeout: 5000, // Set a timeout of 5000 milliseconds
        });
        if (response.data && response.data.result) {
            return response.data.result;
        }
        else {
            return null;
        }
    }
    catch (error) {
        const err = error;
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
//# sourceMappingURL=Web3.js.map