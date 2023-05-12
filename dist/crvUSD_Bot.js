import fs from "fs";
import { getWeb3WsProvider } from "./utils/helperFunctions/Web3.js";
import { getPastEvents, subscribeToEvents } from "./utils/web3Calls/generic.js";
import { telegramBotMain } from "./utils/telegram/TelegramBot.js";
import { processTokenExchangeEvent, processBorrowEvent, processRepayEvent, processRemoveCollateralEvent, processLiquidateEvent } from "./utils/helperFunctions/Decoding.js";
import { buildTokenExchangeMessage, buildBorrowMessage, buildRepayMessage, buildRemoveCollateralMessage, buildLiquidateMessage } from "./utils/telegram/TelegramBot.js";
import { EventEmitter } from "events";
console.clear();
// const ENV = "prod";
const ENV = "test";
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
    const ADDRESS_AMM = "0x77fCFB78151c676f390a6236A78b5d3152e43384";
    const ABI_AMM_RAW = fs.readFileSync("../JSONs/AmmAbi.json", "utf8");
    const ABI_AMM = JSON.parse(ABI_AMM_RAW);
    const ADDRESS_CONTROLLER = "0xCdEdbd0AD036C046eDB19576ee65ea96b26075b1";
    const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
    const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);
    const AMM = new WEB3_WS_PROVIDER.eth.Contract(ABI_AMM, ADDRESS_AMM);
    const CONTROLLER = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);
    //////////////////////// HISTO MODE ////////////////////////
    /*
    const START_BLOCK = 17239726;
    const END_BLOCK = 17239726;
  
    const PAST_EVENTS_AMM = await getPastEvents(AMM, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_AMM instanceof Array)) return;
  
    for (const AMM_EVENT of PAST_EVENTS_AMM) {
      if ((AMM_EVENT as { event: string }).event !== "TokenExchange") continue;
      console.log(AMM_EVENT);
      const formattedEventData = await processTokenExchangeEvent(AMM_EVENT);
      if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
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
    console.log(i);
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////// LIVE MODE ////////////////////////
    await subscribeToEvents(AMM, eventEmitter);
    eventEmitter.on("newEvent", async (EVENT) => {
        if (EVENT.event === "TokenExchange") {
            console.log("New TokenExchange Event picked up by the Emitter:", EVENT);
            const formattedEventData = await processTokenExchangeEvent(EVENT);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildTokenExchangeMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
    });
    await subscribeToEvents(CONTROLLER, eventEmitter);
    eventEmitter.on("newEvent", async (CONTROLLER_EVENT) => {
        if (CONTROLLER_EVENT === "Borrow") {
            const formattedEventData = await processBorrowEvent(CONTROLLER_EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildBorrowMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (CONTROLLER_EVENT === "Repay") {
            let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER, CONTROLLER_EVENT);
            if (liquidateEventQuestion == true)
                return;
            const formattedEventData = await processRepayEvent(CONTROLLER_EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRepayMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (CONTROLLER_EVENT === "RemoveCollateral") {
            const formattedEventData = await processRemoveCollateralEvent(CONTROLLER_EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildRemoveCollateralMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (CONTROLLER_EVENT === "Liquidate") {
            const formattedEventData = await processLiquidateEvent(CONTROLLER_EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildLiquidateMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
    });
}
await main();
//# sourceMappingURL=crvUSD_Bot.js.map