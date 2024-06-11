import { getTgBot, telegramBotMain } from './utils/telegram/TelegramBot.js';
import { launchCurveLendingMonitoring } from './utils/Lending/LlamalendMain.js';
import { bootWsProvider, checkWsConnectionViaNewBlocks, eraseWebProvider, setupDeadWebsocketListener, } from './utils/web3connections.js';
import { launchClassicCrvUSDMonitoring, launchPegkeeper } from './utils/ClassicCrvUSD/main.js';
import eventEmitter from './utils/EventEmitter.js';
console.clear();
// ********************* Classic crvUSD **************
export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 100000;
export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 65000;
export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 5000;
// export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0;
// ********************* Lending *********************
export const LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING = 100000;
export const LENDING_MIN_LIQUIDATION_DISCOUNT_WORTH_PRINTING = 35;
export const LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0.1;
// export const LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING = 0;
// export const LENDING_MIN_LIQUIDATION_DISCOUNT_WORTH_PRINTING = 0;
// export const LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0.1;
// ***************************************************
const ENV = 'prod';
// const ENV = 'test';
const bot = getTgBot(ENV);
export async function main() {
    // WS Connectivy Things
    await eraseWebProvider(); // cleaning all perhaps existing WS.
    await bootWsProvider(); // starting new WS connection.
    eventEmitter.removeAllListeners();
    setupDeadWebsocketListener();
    await telegramBotMain(ENV, bot);
    await launchCurveLendingMonitoring();
    await launchClassicCrvUSDMonitoring();
    await launchPegkeeper();
    // WS Connectivy Things
    await checkWsConnectionViaNewBlocks(); // restarts main if WS dead for 30s.
}
await main();
// await conductResearch();
//# sourceMappingURL=crvUSD_Bot.js.map