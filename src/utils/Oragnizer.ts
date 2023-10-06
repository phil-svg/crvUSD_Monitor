import fs from "fs";
import { getWeb3WsProvider } from "./helperFunctions/Web3.js";
import { getPastEvents, subscribeToEvents } from "./web3Calls/generic.js";
import { processBorrowEvent, processLiquidateEvent, processRemoveCollateralEvent, processRepayEvent, processTokenExchangeEvent } from "./helperFunctions/Decoding.js";
import { buildTokenExchangeMessage, buildRemoveCollateralMessage, buildLiquidateMessage } from "./telegram/TelegramBot.js";
import { buildBorrowMessage, buildRepayMessage } from "./telegram/TelegramBot.js";
import { updateCheatSheet } from "./CollatCheatSheet.js";
import { MIN_REPAYED_AMOUNT_WORTH_PRINTING } from "../crvUSD_Bot.js";
import { promisify } from "util";

// Promisify the necessary fs methods for easier async/await usage
export const writeFileAsync = promisify(fs.writeFile);
export const readFileAsync = promisify(fs.readFile);

async function saveLastSeenToFile(hash: string, timestamp: Date) {
  const data = {
    txHash: hash,
    txTimestamp: timestamp.toISOString(),
  };
  await writeFileAsync("lastSeen.json", JSON.stringify(data, null, 2));
}

async function isLiquidateEvent(CONTROLLER: any, CONTROLLER_EVENT: any) {
  let blockNumber = CONTROLLER_EVENT.blockNumber;
  let txHash = CONTROLLER_EVENT.transactionHash;
  const PAST_EVENTS_CONTROLLER = await getPastEvents(CONTROLLER, "Liquidate", blockNumber, blockNumber);

  return Array.isArray(PAST_EVENTS_CONTROLLER) && PAST_EVENTS_CONTROLLER.some((event: any) => event.transactionHash === txHash);
}

export let lastSeenTxHash: string | null = null;
export let lastSeenTxTimestamp: Date | null = null;

export async function manageMarket(MARKET: any, eventEmitter: any): Promise<void> {
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
  const START_BLOCK = 18290056;
  const END_BLOCK = 18290056;

  const PAST_EVENTS_AMM_CONTRACT = await getPastEvents(AMM_CONTRACT, "allEvents", START_BLOCK, END_BLOCK);

  if (!(PAST_EVENTS_AMM_CONTRACT instanceof Array)) return;

  for (const AMM_EVENT of PAST_EVENTS_AMM_CONTRACT) {
    if ((AMM_EVENT as { event: string }).event !== "TokenExchange") continue;
    const formattedEventData = await processTokenExchangeEvent(AMM_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
    if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) continue;
    const message = await buildTokenExchangeMessage(formattedEventData);
    if (message === "don't print tiny liquidations") continue;
    eventEmitter.emit("newMessage", message);
  }

  const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(CONTROLLER_CONTRACT, "allEvents", START_BLOCK, END_BLOCK);

  if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array)) return;

  for (const CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
    if ((CONTROLLER_EVENT as { event: string }).event === "Borrow") {
      const formattedEventData = await processBorrowEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
      console.log("formattedEventData in Borrow", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) continue;
      if (formattedEventData.collateral_increase_value && formattedEventData.collateral_increase_value < MIN_REPAYED_AMOUNT_WORTH_PRINTING) continue;
      const message = await buildBorrowMessage(formattedEventData);
      if (message === "don't print tiny liquidations") continue;
      eventEmitter.emit("newMessage", message);
    } else if ((CONTROLLER_EVENT as { event: string }).event === "Repay") {
      let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, CONTROLLER_EVENT);
      if (liquidateEventQuestion == true) continue;
      const formattedEventData = await processRepayEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
      console.log("formattedEventData in Repay", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) continue;
      if (formattedEventData.loan_decrease < MIN_REPAYED_AMOUNT_WORTH_PRINTING) continue;
      const message = await buildRepayMessage(formattedEventData);
      eventEmitter.emit("newMessage", message);
    } else if ((CONTROLLER_EVENT as { event: string }).event === "RemoveCollateral") {
      const formattedEventData = await processRemoveCollateralEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
      console.log("formattedEventData in RemoveCollateral", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) continue;
      const message = await buildRemoveCollateralMessage(formattedEventData);
      if (message === "don't print small amounts") continue;
      eventEmitter.emit("newMessage", message);
    } else if ((CONTROLLER_EVENT as { event: string }).event === "Liquidate") {
      const formattedEventData = await processLiquidateEvent(CONTROLLER_EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, ADDRESS_AMM);
      console.log("formattedEventData in Liquidate", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) continue;
      const message = await buildLiquidateMessage(formattedEventData, ADDRESS_CONTROLLER, ADDRESS_AMM);
      if (message === "don't print tiny hard-liquidations") continue;
      eventEmitter.emit("newMessage", message);
    }
  }
  */

  // process.exit();

  ////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////

  //////////////////////// LIVE MODE ////////////////////////

  await subscribeToEvents(AMM_CONTRACT, eventEmitter, MARKET);
  await subscribeToEvents(CONTROLLER_CONTRACT, eventEmitter, MARKET);
}

export async function handleLiveEvents(eventEmitter: any) {
  eventEmitter.on("newEvent", async ({ eventData: EVENT, Market: MARKET }: EventAndMarket) => {
    // for command checking when was the last seen tx.
    await saveLastSeenToFile(EVENT.transactionHash, new Date());
    console.log("New Event picked up by the Emitter:", EVENT, "..with Market:", MARKET);
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    const ADDRESS_COLLATERAL = MARKET.returnValues.collateral;
    const ADDRESS_CONTROLLER = MARKET.returnValues.controller;
    const AMM_ADDRESS = MARKET.returnValues.amm;
    const ABI_CONTROLLER = JSON.parse(fs.readFileSync("../JSONs/ControllerAbi.json", "utf8"));
    const CONTROLLER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);

    if (EVENT.event === "Borrow") {
      const formattedEventData = await processBorrowEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
      console.log("formattedEventData in Borrow", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) return;
      if (formattedEventData.collateral_increase_value && formattedEventData.collateral_increase_value < MIN_REPAYED_AMOUNT_WORTH_PRINTING) return;
      const message = await buildBorrowMessage(formattedEventData);
      if (message === "don't print tiny liquidations") return;
      eventEmitter.emit("newMessage", message);
    } else if (EVENT.event === "Repay") {
      let liquidateEventQuestion = await isLiquidateEvent(CONTROLLER_CONTRACT, EVENT);
      if (liquidateEventQuestion == true) return;
      const formattedEventData = await processRepayEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
      console.log("formattedEventData in Repay", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) return;
      if (formattedEventData.loan_decrease < MIN_REPAYED_AMOUNT_WORTH_PRINTING) return;
      const message = await buildRepayMessage(formattedEventData);
      eventEmitter.emit("newMessage", message);
    } else if (EVENT.event === "RemoveCollateral") {
      const formattedEventData = await processRemoveCollateralEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
      console.log("formattedEventData in RemoveCollateral", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) return;
      const message = await buildRemoveCollateralMessage(formattedEventData);
      if (message === "don't print small amounts") return;
      eventEmitter.emit("newMessage", message);
    } else if (EVENT.event === "Liquidate") {
      const formattedEventData = await processLiquidateEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
      console.log("formattedEventData in Liquidate", formattedEventData);
      if (Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) return;
      const message = await buildLiquidateMessage(formattedEventData, ADDRESS_CONTROLLER, AMM_ADDRESS);
      if (message === "don't print tiny hard-liquidations") return;
      eventEmitter.emit("newMessage", message);

      // AMM EVENT
    } else if (EVENT.event === "TokenExchange") {
      const formattedEventData = await processTokenExchangeEvent(EVENT, ADDRESS_CONTROLLER, ADDRESS_COLLATERAL, AMM_ADDRESS);
      if (!formattedEventData || Object.values(formattedEventData).some((value) => value === undefined || Number.isNaN(value))) return;
      const message = await buildTokenExchangeMessage(formattedEventData);
      if (message === "don't print tiny liquidations") return;
      eventEmitter.emit("newMessage", message);
    }
  });
}

interface EventAndMarket {
  eventData: any;
  Market: any;
}
