import { getWeb3WsProvider } from "./utils/helperFunctions/Web3.js";
import { getCurrentBlockNumber, getPastEvents } from "./utils/web3Calls/generic.js";
import { telegramBotMain } from "./utils/telegram/TelegramBot.js";
import { EventEmitter } from "events";
import { handleLiveEvents, manageMarket } from "./utils/Oragnizer.js";
import { ADDRESS_crvUSD_ControllerFactory } from "./utils/Constants.js";
import { livemodePegKeepers } from "./utils/pegkeeper/Pegkeeper.js";
import { ABI_crvUSD_ControllerFactory } from "./utils/abis/ABI_crvUSD_ControllerFactory.js";
console.clear();
export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 100000;
export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 28000;
export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 5000;
// export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0;
const ENV = "prod";
// const ENV = "test";
const eventEmitter = new EventEmitter();
async function watchingForNewMarketOpenings(crvUSD_ControllerFactory) {
    const subscription = crvUSD_ControllerFactory.events.AddMarket();
    subscription
        .on("connected", () => {
        console.log(crvUSD_ControllerFactory._address, `subscribed to new market event successfully`);
    })
        .on("data", async (marketCreation) => {
        console.log("NEW MARKET!!!");
        await manageMarket(marketCreation, eventEmitter);
    })
        .on("error", (error) => {
        console.error("Error in event subscription: ", error);
    });
}
async function main() {
    await telegramBotMain(ENV, eventEmitter);
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    const crvUSD_ControllerFactory = new WEB3_WS_PROVIDER.eth.Contract(ABI_crvUSD_ControllerFactory, ADDRESS_crvUSD_ControllerFactory);
    const crvUSD_LAUNCH_BLOCK = 17257955;
    const PRESENT = await getCurrentBlockNumber();
    await livemodePegKeepers(PRESENT, eventEmitter);
    // await pegkeeperHisto(eventEmitter, 19046609, 19096615);
    const ADDED_MARKET_EVENTS = await getPastEvents(crvUSD_ControllerFactory, "AddMarket", crvUSD_LAUNCH_BLOCK, PRESENT);
    if (!(ADDED_MARKET_EVENTS instanceof Array))
        return;
    for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
        await manageMarket(MARKET_CREATION, eventEmitter);
    }
    await watchingForNewMarketOpenings(crvUSD_ControllerFactory);
    await handleLiveEvents(eventEmitter);
    console.log("crvUSD_Bot launched successfully.");
}
await main();
// await conductResearch();
//# sourceMappingURL=crvUSD_Bot.js.map