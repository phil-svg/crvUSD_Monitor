import fs from "fs";
import { getWeb3WsProvider } from "./utils/helperFunctions/Web3.js";
import { getPastEvents, subscribeToEvents } from "./utils/web3Calls/generic.js";
import { telegramBotMain } from "./utils/telegram/TelegramBot.js";
import { processTokenExchangeEvent, processBorrowEvent, processRepayEvent, processRemoveCollateralEvent, processLiquidateEvent } from "./utils/helperFunctions/Decoding.js";
import { buildTokenExchangeMessage, buildBorrowMessage, buildRepayMessage, buildRemoveCollateralMessage, buildLiquidateMessage } from "./utils/telegram/TelegramBot.js";
import { EventEmitter } from "events";
console.clear();
const ENV = "prod";
// const ENV = "test";
const eventEmitter = new EventEmitter();
async function isLiquidateEvent(CONTROLLER, CONTROLLER_EVENT) {
    let blockNumber = CONTROLLER_EVENT.blockNumber;
    let txHash = CONTROLLER_EVENT.transactionHash;
    const PAST_EVENTS_CONTROLLER = await getPastEvents(CONTROLLER, "Liquidate", blockNumber, blockNumber);
    return Array.isArray(PAST_EVENTS_CONTROLLER) && PAST_EVENTS_CONTROLLER.some((event) => event.transactionHash === txHash);
}
async function main() {
    await telegramBotMain(ENV, eventEmitter);
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    const ADDRESS_AMM = "0x136e783846ef68C8Bd00a3369F787dF8d683a696";
    const ABI_AMM_RAW = fs.readFileSync("../JSONs/AmmAbi.json", "utf8");
    const ABI_AMM = JSON.parse(ABI_AMM_RAW);
    const ADDRESS_CONTROLLER = "0x8472A9A7632b173c8Cf3a86D3afec50c35548e76";
    const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
    const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);
    const AMM = new WEB3_WS_PROVIDER.eth.Contract(ABI_AMM, ADDRESS_AMM);
    const CONTROLLER = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);
    //////////////////////// HISTO MODE ////////////////////////
    /*
    const START_BLOCK = 17301177;
    const END_BLOCK = 17301177;
  
    // const START_BLOCK = 17301177;
    // const END_BLOCK = 17301177;
  
    const PAST_EVENTS_AMM = await getPastEvents(AMM, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_AMM instanceof Array)) return;
  
    for (const AMM_EVENT of PAST_EVENTS_AMM) {
      if ((AMM_EVENT as { event: string }).event !== "TokenExchange") continue;
      console.log("AMM_EVENT", AMM_EVENT);
      const formattedEventData = await processTokenExchangeEvent(AMM_EVENT);
      if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined)) continue;
      const message = await buildTokenExchangeMessage(formattedEventData);
      eventEmitter.emit("newMessage", message);
    }
  
    const PAST_EVENTS_CONTROLLER = await getPastEvents(CONTROLLER, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_CONTROLLER instanceof Array)) return;
  
    let i = 0;
  
    for (const CONTROLLER_EVENT of PAST_EVENTS_CONTROLLER) {
      if ((CONTROLLER_EVENT as { event: string }).event === "Borrow") {
        const formattedEventData = await processBorrowEvent(CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildBorrowMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((CONTROLLER_EVENT as { event: string }).event === "Repay") {
        let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER, CONTROLLER_EVENT);
        if (liquidateEventQuestion == true) continue;
        const formattedEventData = await processRepayEvent(CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
  
        const message = await buildRepayMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((CONTROLLER_EVENT as { event: string }).event === "RemoveCollateral") {
        const formattedEventData = await processRemoveCollateralEvent(CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildRemoveCollateralMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((CONTROLLER_EVENT as { event: string }).event === "Liquidate") {
        const formattedEventData = await processLiquidateEvent(CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildLiquidateMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      }
    }
    process.exit();
    console.log(i);
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////// LIVE MODE ////////////////////////
    await subscribeToEvents(AMM, eventEmitter);
    await subscribeToEvents(CONTROLLER, eventEmitter);
    eventEmitter.on("newEvent", async (EVENT) => {
        console.log("New Event picked up by the Emitter:", EVENT);
        // CONTROLLER EVENTS
        if (EVENT.event === "Borrow") {
            const formattedEventData = await processBorrowEvent(EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildBorrowMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "Repay") {
            let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER, EVENT);
            if (liquidateEventQuestion == true)
                return;
            const formattedEventData = await processRepayEvent(EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRepayMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "RemoveCollateral") {
            const formattedEventData = await processRemoveCollateralEvent(EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRemoveCollateralMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "Liquidate") {
            const formattedEventData = await processLiquidateEvent(EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildLiquidateMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
            // AMM EVENT
        }
        else if (EVENT.event === "TokenExchange") {
            const formattedEventData = await processTokenExchangeEvent(EVENT);
            if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildTokenExchangeMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
    });
    console.log("crvUSD_Bot launched successfully.");
}
await main();
//# sourceMappingURL=crvUSD_Bot.js.map