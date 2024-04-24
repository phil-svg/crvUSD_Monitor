import Web3 from 'web3';
import EventEmitter from 'events';
import { main } from '../crvUSD_Bot.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
export const eventEmitter = new EventEmitter();
export const eventEmitterTelegramBotRelated = new EventEmitter();
export let WEB3_HTTP_PROVIDER = await getWeb3HttpProvider();
export let WEB3_WS_PROVIDER = getWeb3WsProvider();
let subscription; // Holds the subscription object
function getWeb3WsProvider() {
    let web3WsProvider = null;
    const wsProvider = new Web3.providers.WebsocketProvider(process.env.WEB3_WSS);
    // Attach 'end' event listener
    wsProvider.on('end', (err) => {
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
async function getWeb3HttpProvider() {
    let web3HttpProvider = null;
    const MAX_RETRIES = 5; // Maximum number of retries
    const RETRY_DELAY = 5000; // Delay between retries in milliseconds
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            web3HttpProvider = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_HTTP));
            await web3HttpProvider.eth.net.isListening(); // This will throw an error if it can't connect
            return web3HttpProvider;
        }
        catch (error) {
            if (error instanceof Error) {
                const err = error;
                if (err.code === 'ECONNABORTED') {
                    console.log(`HTTP Provider connection timed out. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else if (err.message && err.message.includes('CONNECTION ERROR')) {
                    console.log(`HTTP Provider connection error. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                else {
                    console.log(`Failed to connect to Ethereum node. Attempt ${retries + 1} of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY / 1000} seconds.`);
                }
                retries++;
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    throw new Error('Failed to connect to Ethereum node after several attempts. Please check your connection and the status of the Ethereum node.');
}
export async function checkWsConnectionViaNewBlocks() {
    let lastSavedBlockNumber = 0;
    let lastReveivedBlockNumber = 0;
    subscription = WEB3_WS_PROVIDER.eth.subscribe('newBlockHeaders', async (err, blockHeader) => {
        lastReveivedBlockNumber = blockHeader.number;
        console.log('New block', blockHeader.number, new Date().toLocaleTimeString());
    });
    await new Promise((resolve) => setTimeout(resolve, 20000));
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        if (lastSavedBlockNumber === lastReveivedBlockNumber)
            break;
        lastSavedBlockNumber = lastReveivedBlockNumber;
    }
    eventEmitter.emit('dead websocket connection');
    return;
}
export function setupDeadWebsocketListener() {
    eventEmitter.on('dead websocket connection', async () => {
        console.log('Dead WebSocket connection detected, restarting in 3 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await main();
    });
}
export async function eraseWebProvider() {
    // console.log("Trying to erase Web3 Provider!");
    // Disconnect WebSocket Provider
    if (typeof WEB3_WS_PROVIDER !== 'undefined' && WEB3_WS_PROVIDER !== null) {
        const wsProvider = WEB3_WS_PROVIDER.currentProvider;
        if (wsProvider && wsProvider instanceof Web3.providers.WebsocketProvider) {
            wsProvider.disconnect(1000, 'Manual disconnect');
            console.log('WebSocket Provider disconnected.');
        }
    }
}
export async function bootWsProvider() {
    WEB3_WS_PROVIDER = getWeb3WsProvider();
    console.log('WebSocket Provider connected.');
}
//# sourceMappingURL=web3connections.js.map