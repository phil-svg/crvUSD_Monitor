import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasUndefinedOrNaNValues, processBorrowEvent, processLiquidateEvent, processRemoveCollateralEvent, processRepayEvent, processTokenExchangeEvent, } from './helperFunctions/Decoding.js';
import { buildTokenExchangeMessage, buildRemoveCollateralMessage, buildLiquidateMessage, } from './telegram/TelegramBot.js';
import { buildBorrowMessage, buildRepayMessage } from './telegram/TelegramBot.js';
import { updateCheatSheet } from './CollatCheatSheet.js';
import { MIN_REPAYED_AMOUNT_WORTH_PRINTING } from '../crvUSD_Bot.js';
import { ABI_AMM } from './abis/ABI_AMM.js';
import { ABI_Controller } from './abis/ABI_Controller.js';
import { getDSProxyOwner, isDefiSaverSmartWallet } from './defisaver/DefiSaver.js';
import eventEmitter from './EventEmitter.js';
import { getPastEvents, getTxFromTxHash, web3HttpProvider } from './web3/Web3Basics.js';
import { fetchEventsRealTime, registerHandler } from './web3/AllEvents.js';
export async function watchingForNewMarketOpenings(address, abi) {
    try {
        registerHandler(async (logs) => {
            const events = await fetchEventsRealTime(logs, address, abi, 'AddMarket');
            if (events.length > 0) {
                events.forEach((event) => {
                    console.log('NEW MARKET!!!');
                    manageMarket(event);
                });
            }
        });
    }
    catch (err) {
        console.log('Error in fetching events:', err);
    }
}
export async function saveLastSeenToFile(hash, timestamp) {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '../../lastSeen.json');
        const data = {
            txHash: hash,
            txTimestamp: timestamp.toISOString(),
        };
        await writeFile(filePath, JSON.stringify(data, null, 2));
    }
    catch (error) {
        console.error('Error writing last seen data to file:', error);
    }
}
export async function isLiquidateEvent(CONTROLLER, CONTROLLER_EVENT) {
    let blockNumber = CONTROLLER_EVENT.blockNumber;
    let txHash = CONTROLLER_EVENT.transactionHash;
    const PAST_EVENTS_CONTROLLER = await getPastEvents(CONTROLLER, 'Liquidate', blockNumber, blockNumber);
    return (Array.isArray(PAST_EVENTS_CONTROLLER) &&
        PAST_EVENTS_CONTROLLER.some((event) => event.transactionHash === txHash));
}
export let lastSeenTxHash = null;
export let lastSeenTxTimestamp = null;
export async function manageMarket(market) {
    const ADDRESS_COLLATERAL = market.returnValues.collateral;
    const ADDRESS_CONTROLLER = market.returnValues.controller;
    const CONTROLLER_CONTRACT = new web3HttpProvider.eth.Contract(ABI_Controller, ADDRESS_CONTROLLER);
    const ADDRESS_AMM = market.returnValues.amm;
    const AMM_CONTRACT = new web3HttpProvider.eth.Contract(ABI_AMM, ADDRESS_AMM);
    // console.log('ADDRESS_COLLATERAL', ADDRESS_COLLATERAL);
    // console.log('ADDRESS_CONTROLLER', ADDRESS_CONTROLLER);
    // console.log('ADDRESS_AMM', ADDRESS_AMM, '\n');
    await updateCheatSheet(ADDRESS_COLLATERAL);
    //////////////////////// HISTO MODE ////////////////////////
    const START_BLOCK = 22019155;
    const END_BLOCK = 22019155;
    const PAST_EVENTS_AMM_CONTRACT = await getPastEvents(AMM_CONTRACT, 'allEvents', START_BLOCK, END_BLOCK);
    if (!(PAST_EVENTS_AMM_CONTRACT instanceof Array))
        return;
    for (const AMM_EVENT of PAST_EVENTS_AMM_CONTRACT) {
        console.log('AMM_EVENT', AMM_EVENT);
        if (AMM_EVENT.event !== 'TokenExchange')
            continue;
        const formattedEventData = await processTokenExchangeEvent(AMM_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
        console.log('formattedEventData', formattedEventData);
        if (!formattedEventData ||
            Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value)))
            continue;
        const message = await buildTokenExchangeMessage(formattedEventData);
        if (message === "don't print tiny liquidations")
            continue;
        eventEmitter.emit('newMessage', message);
    }
    const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(CONTROLLER_CONTRACT, 'allEvents', START_BLOCK, END_BLOCK);
    if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array))
        return;
    for (const CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
        console.log('processing CONTROLLER EVENT', CONTROLLER_EVENT);
        // DEFI-SAVER START
        const txHash = CONTROLLER_EVENT.transactionHash;
        const tx = await getTxFromTxHash(txHash);
        const DEFI_SAVER_crvUSD_AUTOMATION_CONTRACT_ADDRESS = '0x252025df8680c275d0ba80d084e5967d8bd26caf';
        let isDefiSaverAutomatedTx = false;
        if (tx.to.toLowerCase() === DEFI_SAVER_crvUSD_AUTOMATION_CONTRACT_ADDRESS.toLowerCase())
            isDefiSaverAutomatedTx = true;
        let isManualSmartWalletTx = false;
        let dfsCheck = await isDefiSaverSmartWallet(tx.to);
        if (dfsCheck === true)
            isManualSmartWalletTx = true;
        let defiSaverUser = '';
        if (isManualSmartWalletTx) {
            defiSaverUser = tx.from;
        }
        if (isDefiSaverAutomatedTx) {
            const DSProxy_Address = CONTROLLER_EVENT.returnValues['0'];
            const user = await getDSProxyOwner(DSProxy_Address);
            defiSaverUser = user;
        }
        // DEFI-SAVER END
        if (CONTROLLER_EVENT.event === 'Borrow') {
            const formattedEventData = await processBorrowEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
            if (hasUndefinedOrNaNValues(formattedEventData))
                continue;
            if (formattedEventData.collateral_increase_value &&
                formattedEventData.collateral_increase_value < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
                continue;
            const message = await buildBorrowMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            if (message === "don't print tiny liquidations")
                continue;
            eventEmitter.emit('newMessage', message);
        }
        else if (CONTROLLER_EVENT.event === 'Repay') {
            let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, CONTROLLER_EVENT);
            if (liquidateEventQuestion == true)
                continue;
            const formattedEventData = await processRepayEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
            if (hasUndefinedOrNaNValues(formattedEventData))
                continue;
            if (formattedEventData.loan_decrease < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
                continue;
            const message = await buildRepayMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            eventEmitter.emit('newMessage', message);
        }
        else if (CONTROLLER_EVENT.event === 'RemoveCollateral') {
            const formattedEventData = await processRemoveCollateralEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
            if (hasUndefinedOrNaNValues(formattedEventData))
                continue;
            const message = await buildRemoveCollateralMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            if (message === "don't print small amounts")
                continue;
            eventEmitter.emit('newMessage', message);
        }
        else if (CONTROLLER_EVENT.event === 'Liquidate') {
            const formattedEventData = await processLiquidateEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
            if (hasUndefinedOrNaNValues(formattedEventData))
                continue;
            const message = await buildLiquidateMessage(formattedEventData, ADDRESS_CONTROLLER, ADDRESS_AMM);
            if (message === "don't print tiny hard-liquidations")
                continue;
            eventEmitter.emit('newMessage', message);
        }
    }
    // process.exit();
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////// LIVE MODE ////////////////////////
    await subscribeToEvents(ADDRESS_AMM, ABI_AMM, market);
    await subscribeToEvents(ADDRESS_CONTROLLER, ABI_Controller, market);
}
async function subscribeToEvents(address, abi, market) {
    try {
        registerHandler(async (logs) => {
            const events = await fetchEventsRealTime(logs, address, abi, 'AllEvents');
            if (events.length > 0) {
                events.forEach((event) => {
                    console.log('New event in crvUSD Classic:', event.transactionHash);
                    eventEmitter.emit('newEvent', { event, market });
                });
            }
        });
    }
    catch (err) {
        console.log('Error in fetching events:', err);
    }
}
export async function handleLiveEvents() {
    eventEmitter.on('newEvent', async ({ event, market }) => {
        // for command checking when was the last seen tx.
        await saveLastSeenToFile(event.transactionHash, new Date());
        const ADDRESS_COLLATERAL = market.returnValues.collateral;
        const ADDRESS_CONTROLLER = market.returnValues.controller;
        const AMM_ADDRESS = market.returnValues.amm;
        const CONTROLLER_CONTRACT = new web3HttpProvider.eth.Contract(ABI_Controller, ADDRESS_CONTROLLER);
        // DEFI-SAVER START
        const txHash = event.transactionHash;
        const tx = await getTxFromTxHash(txHash);
        if (!tx) {
            console.log('failed to fetch tx');
            return;
        }
        const DEFI_SAVER_crvUSD_AUTOMATION_CONTRACT_ADDRESS = '0x252025df8680c275d0ba80d084e5967d8bd26caf';
        let isDefiSaverAutomatedTx = false;
        if (tx.to.toLowerCase() === DEFI_SAVER_crvUSD_AUTOMATION_CONTRACT_ADDRESS.toLowerCase())
            isDefiSaverAutomatedTx = true;
        let isManualSmartWalletTx = false;
        let dfsCheck = await isDefiSaverSmartWallet(tx.to);
        if (dfsCheck === true)
            isManualSmartWalletTx = true;
        let defiSaverUser = '';
        if (isManualSmartWalletTx) {
            defiSaverUser = tx.from;
        }
        if (isDefiSaverAutomatedTx) {
            const DSProxy_Address = event.returnValues['0'];
            const user = await getDSProxyOwner(DSProxy_Address);
            defiSaverUser = user;
        }
        // console.log('isDefiSaverAutomatedTx', isDefiSaverAutomatedTx);
        // console.log('isManualSmartWalletTx', isManualSmartWalletTx);
        // console.log('defiSaverUser', defiSaverUser);
        // DEFI-SAVER END
        if (event.event === 'Borrow') {
            const formattedEventData = await processBorrowEvent(event, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
            if (hasUndefinedOrNaNValues(formattedEventData))
                return;
            if (formattedEventData.collateral_increase_value &&
                formattedEventData.collateral_increase_value < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
                return;
            const message = await buildBorrowMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            if (message === "don't print tiny liquidations")
                return;
            eventEmitter.emit('newMessage', message);
        }
        else if (event.event === 'Repay') {
            let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, event);
            if (liquidateEventQuestion == true)
                return;
            const formattedEventData = await processRepayEvent(event, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
            if (hasUndefinedOrNaNValues(formattedEventData))
                return;
            if (formattedEventData.loan_decrease < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
                return;
            const message = await buildRepayMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            eventEmitter.emit('newMessage', message);
        }
        else if (event.event === 'RemoveCollateral') {
            const formattedEventData = await processRemoveCollateralEvent(event, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
            if (hasUndefinedOrNaNValues(formattedEventData))
                return;
            const message = await buildRemoveCollateralMessage(formattedEventData, isDefiSaverAutomatedTx, isManualSmartWalletTx, defiSaverUser);
            if (message === "don't print small amounts")
                return;
            eventEmitter.emit('newMessage', message);
        }
        else if (event.event === 'Liquidate') {
            const formattedEventData = await processLiquidateEvent(event, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
            if (hasUndefinedOrNaNValues(formattedEventData))
                return;
            const message = await buildLiquidateMessage(formattedEventData, ADDRESS_CONTROLLER, AMM_ADDRESS);
            if (message === "don't print tiny hard-liquidations")
                return;
            eventEmitter.emit('newMessage', message);
            // AMM EVENT
        }
        else if (event.event === 'TokenExchange') {
            const formattedEventData = await processTokenExchangeEvent(event, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
            if (!formattedEventData ||
                Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value)))
                return;
            const message = await buildTokenExchangeMessage(formattedEventData);
            if (message === "don't print tiny liquidations")
                return;
            eventEmitter.emit('newMessage', message);
        }
    });
}
//# sourceMappingURL=Oragnizer.js.map