import fs from "fs";
import { getWeb3WsProvider } from "./helperFunctions/Web3.js";
import { getPastEvents, subscribeToEvents } from "./web3Calls/generic.js";
import { processBorrowEvent, processLiquidateEvent, processRemoveCollateralEvent, processRepayEvent, processTokenExchangeEvent } from "./helperFunctions/Decoding.js";
import { buildTokenExchangeMessage, buildRemoveCollateralMessage, buildLiquidateMessage } from "./telegram/TelegramBot.js";
import { buildBorrowMessage, buildRepayMessage } from "./telegram/TelegramBot.js";
import { updateCheatSheet } from "./CollatCheatSheet.js";
async function isLiquidateEvent(CONTROLLER, CONTROLLER_EVENT) {
    let blockNumber = CONTROLLER_EVENT.blockNumber;
    let txHash = CONTROLLER_EVENT.transactionHash;
    const PAST_EVENTS_CONTROLLER = await getPastEvents(CONTROLLER, "Liquidate", blockNumber, blockNumber);
    return Array.isArray(PAST_EVENTS_CONTROLLER) && PAST_EVENTS_CONTROLLER.some((event) => event.transactionHash === txHash);
}
export async function manageMarket(MARKET, eventEmitter) {
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    const ADDRESS_COLLATERAL = MARKET.returnValues.collateral;
    const ADDRESS_CONTROLLER = MARKET.returnValues.controller;
    const ABI_CONTROLLER = JSON.parse(fs.readFileSync("../JSONs/ControllerAbi.json", "utf8"));
    const CONTROLLER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);
    const ADDRESS_AMM = MARKET.returnValues.amm;
    const ABI_AMM = JSON.parse(fs.readFileSync("../JSONs/AmmAbi.json", "utf8"));
    const AMM_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_AMM, ADDRESS_AMM);
    console.log("ADDRESS_COLLATERAL", ADDRESS_COLLATERAL);
    console.log("ADDRESS_CONTROLLER", ADDRESS_CONTROLLER);
    console.log("ADDRESS_AMM", ADDRESS_AMM, "\n");
    await updateCheatSheet(ADDRESS_COLLATERAL);
    //////////////////////// HISTO MODE ////////////////////////
    /*
    const START_BLOCK = 17432225;
    const END_BLOCK = 17432312;
  
    // const START_BLOCK = 17429289;
    // const END_BLOCK = 17429289;
  
    const PAST_EVENTS_AMM_CONTRACT = await getPastEvents(AMM_CONTRACT, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_AMM_CONTRACT instanceof Array)) return;
  
    for (const AMM_EVENT of PAST_EVENTS_AMM_CONTRACT) {
      if ((AMM_EVENT as { event: string }).event !== "TokenExchange") continue;
      console.log("AMM_EVENT", AMM_EVENT);
      const formattedEventData = await processTokenExchangeEvent(AMM_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
      if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined)) continue;
      const message = await buildTokenExchangeMessage(formattedEventData);
      eventEmitter.emit("newMessage", message);
    }
  
    const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(CONTROLLER_CONTRACT, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array)) return;
  
    for (const CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
      console.log("CONTROLLER_EVENT", CONTROLLER_EVENT);
      if ((CONTROLLER_EVENT as { event: string }).event === "Borrow") {
        const formattedEventData = await processBorrowEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildBorrowMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
      } else if ((CONTROLLER_EVENT as { event: string }).event === "Repay") {
        let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, CONTROLLER_EVENT);
        if (liquidateEventQuestion == true) continue;
        const formattedEventData = await processRepayEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildRepayMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
      } else if ((CONTROLLER_EVENT as { event: string }).event === "RemoveCollateral") {
        const formattedEventData = await processRemoveCollateralEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildRemoveCollateralMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
      } else if ((CONTROLLER_EVENT as { event: string }).event === "Liquidate") {
        const formattedEventData = await processLiquidateEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildLiquidateMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
      }
    }
    */
    //process.exit();
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////// LIVE MODE ////////////////////////
    await subscribeToEvents(AMM_CONTRACT, eventEmitter, MARKET);
    await subscribeToEvents(CONTROLLER_CONTRACT, eventEmitter, MARKET);
}
export async function handleLiveEvents(eventEmitter) {
    eventEmitter.on("newEvent", async ({ eventData: EVENT, Market: MARKET }) => {
        console.log("New Event picked up by the Emitter:", EVENT, "..Market:", MARKET);
        const WEB3_WS_PROVIDER = getWeb3WsProvider();
        const ADDRESS_COLLATERAL = MARKET.returnValues.collateral;
        const ADDRESS_CONTROLLER = MARKET.returnValues.controller;
        const ABI_CONTROLLER = JSON.parse(fs.readFileSync("../JSONs/ControllerAbi.json", "utf8"));
        const CONTROLLER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);
        if (EVENT.event === "Borrow") {
            const formattedEventData = await processBorrowEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildBorrowMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "Repay") {
            let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, EVENT);
            if (liquidateEventQuestion == true)
                return;
            const formattedEventData = await processRepayEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRepayMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "RemoveCollateral") {
            const formattedEventData = await processRemoveCollateralEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRemoveCollateralMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "Liquidate") {
            const formattedEventData = await processLiquidateEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildLiquidateMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
            // AMM EVENT
        }
        else if (EVENT.event === "TokenExchange") {
            const formattedEventData = await processTokenExchangeEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL);
            if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildTokenExchangeMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
    });
}
//# sourceMappingURL=Oragnizer.js.map