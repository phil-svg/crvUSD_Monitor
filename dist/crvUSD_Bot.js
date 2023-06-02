import fs from "fs";
import { getWeb3WsProvider } from "./utils/helperFunctions/Web3.js";
import { getPastEvents, subscribeToEvents } from "./utils/web3Calls/generic.js";
import { telegramBotMain } from "./utils/telegram/TelegramBot.js";
import { processTokenExchangeEvent, processBorrowEvent, processRepayEvent, processRemoveCollateralEvent, processLiquidateEvent } from "./utils/helperFunctions/Decoding.js";
import { buildTokenExchangeMessage, buildBorrowMessage, buildRepayMessage, buildRemoveCollateralMessage, buildLiquidateMessage } from "./utils/telegram/TelegramBot.js";
import { EventEmitter } from "events";
export const AMM_ADDRESSES = ["0x136e783846ef68C8Bd00a3369F787dF8d683a696"];
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
    const ADDRESS_LLAMMA_crvUSD_AMM = AMM_ADDRESSES[0];
    const ABI_LLAMMA_crvUSD_AMM_RAW = fs.readFileSync("../JSONs/AmmAbi.json", "utf8");
    const ABI_LLAMMA_crvUSD_AMM = JSON.parse(ABI_LLAMMA_crvUSD_AMM_RAW);
    const ADDRESS_crvUSD_CONTROLLER = "0x8472A9A7632b173c8Cf3a86D3afec50c35548e76";
    const ABI_crvUSD_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
    const ABI_crvUSD_CONTROLLER = JSON.parse(ABI_crvUSD_CONTROLLER_RAW);
    const LLAMMA_crvUSD_AMM = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMMA_crvUSD_AMM, ADDRESS_LLAMMA_crvUSD_AMM);
    const crvUSD_CONTROLLER = new WEB3_WS_PROVIDER.eth.Contract(ABI_crvUSD_CONTROLLER, ADDRESS_crvUSD_CONTROLLER);
    //////////////////////// HISTO MODE ////////////////////////
    /*
    const START_BLOCK = 17393673;
    const END_BLOCK = 17394808;
  
    // const START_BLOCK = 17301177;
    // const END_BLOCK = 17301177;
  
    const PAST_EVENTS_LLAMMA_crvUSD_AMM = await getPastEvents(LLAMMA_crvUSD_AMM, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_LLAMMA_crvUSD_AMM instanceof Array)) return;
  
    for (const LLAMMA_crvUSD_AMM_EVENT of PAST_EVENTS_LLAMMA_crvUSD_AMM) {
      if ((LLAMMA_crvUSD_AMM_EVENT as { event: string }).event !== "TokenExchange") continue;
      console.log("AMM_EVENT", LLAMMA_crvUSD_AMM_EVENT);
      const formattedEventData = await processTokenExchangeEvent(LLAMMA_crvUSD_AMM_EVENT);
      if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined)) continue;
      const message = await buildTokenExchangeMessage(formattedEventData);
      eventEmitter.emit("newMessage", message);
    }
  
    const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(crvUSD_CONTROLLER, "allEvents", START_BLOCK, END_BLOCK);
  
    if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array)) return;
  
    let i = 0;
  
    for (const crvUSD_CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
      console.log("crvUSD_CONTROLLER_EVENT", crvUSD_CONTROLLER_EVENT);
      if ((crvUSD_CONTROLLER_EVENT as { event: string }).event === "Borrow") {
        const formattedEventData = await processBorrowEvent(crvUSD_CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildBorrowMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((crvUSD_CONTROLLER_EVENT as { event: string }).event === "Repay") {
        let liquidateEventQuestion = await isLiquidateEvent(crvUSD_CONTROLLER, crvUSD_CONTROLLER_EVENT);
        if (liquidateEventQuestion == true) continue;
        const formattedEventData = await processRepayEvent(crvUSD_CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
  
        const message = await buildRepayMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((crvUSD_CONTROLLER_EVENT as { event: string }).event === "RemoveCollateral") {
        const formattedEventData = await processRemoveCollateralEvent(crvUSD_CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildRemoveCollateralMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      } else if ((crvUSD_CONTROLLER_EVENT as { event: string }).event === "Liquidate") {
        const formattedEventData = await processLiquidateEvent(crvUSD_CONTROLLER_EVENT);
        console.log(formattedEventData);
        if (Object.values(formattedEventData).some((value) => value === undefined)) continue;
        const message = await buildLiquidateMessage(formattedEventData);
        eventEmitter.emit("newMessage", message);
        i++;
      }
    }
    // process.exit();
    console.log(i);
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////// LIVE MODE ////////////////////////
    await subscribeToEvents(LLAMMA_crvUSD_AMM, eventEmitter);
    await subscribeToEvents(crvUSD_CONTROLLER, eventEmitter);
    eventEmitter.on("newEvent", async (EVENT) => {
        console.log("New Event picked up by the Emitter:", EVENT);
        if (EVENT.event === "Borrow") {
            const formattedEventData = await processBorrowEvent(EVENT);
            console.log(formattedEventData);
            if (Object.values(formattedEventData).some((value) => value === undefined))
                return;
            const message = await buildBorrowMessage(formattedEventData);
            eventEmitter.emit("newMessage", message);
        }
        else if (EVENT.event === "Repay") {
            let liquidateEventQuestion = await isLiquidateEvent(crvUSD_CONTROLLER, EVENT);
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