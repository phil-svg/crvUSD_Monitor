import { telegramBotMain } from './utils/telegram/TelegramBot.js';
import { launchCurveLendingMonitoring } from './utils/Lending/LlamalendMain.js';
import eventEmitter, { bootWsProvider, checkWsConnectionViaNewBlocks, eraseWebProvider, setupDeadWebsocketListener, } from './utils/web3connections.js';
import { launchClassicCrvUSDMonitoring } from './utils/ClassicCrvUSD/main.js';
console.clear();
export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 100000;
export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 65000;
export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 5000;
// export const MIN_REPAYED_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING = 0;
// export const MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0;
const ENV = 'prod';
// const ENV = 'test';
export async function main() {
    // WS Connectivy Things
    await eraseWebProvider(); // cleaning all perhaps existing WS.
    await bootWsProvider(); // starting new WS connection.
    eventEmitter.removeAllListeners();
    setupDeadWebsocketListener();
    await launchCurveLendingMonitoring(eventEmitter);
    await launchClassicCrvUSDMonitoring();
    // WS Connectivy Things
    await checkWsConnectionViaNewBlocks(); // restarts main if WS dead for 30s.
}
await telegramBotMain(ENV, eventEmitter);
await main();
// await conductResearch();
//# sourceMappingURL=crvUSD_Bot.js.map