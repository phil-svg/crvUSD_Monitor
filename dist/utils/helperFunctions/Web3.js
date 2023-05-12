import Web3 from "web3";
import dotenv from "dotenv";
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
//# sourceMappingURL=Web3.js.map