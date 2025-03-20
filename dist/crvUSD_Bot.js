import { getTgBot, telegramBotMain } from './utils/telegram/TelegramBot.js';
import { launchCurveLendingMonitoring } from './utils/Lending/LlamalendMain.js';
import { launchClassicCrvUSDMonitoring, launchPegkeeper } from './utils/ClassicCrvUSD/main.js';
import { startListeningToAllEvents } from './utils/web3/AllEvents.js';
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
export const LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 5000;
// export const LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING = 0;
// export const LENDING_MIN_LIQUIDATION_DISCOUNT_WORTH_PRINTING = 0;
// export const LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING = 0.1;
// ***************************************************
const ENV = 'prod';
// const ENV = 'test';
const bot = getTgBot(ENV);
export async function main() {
    console.log('starting startListeningToAllEvents');
    startListeningToAllEvents();
    console.log('starting telegramBotMain');
    await telegramBotMain(ENV, bot);
    console.log('starting launchCurveLendingMonitoring');
    await launchCurveLendingMonitoring();
    console.log('starting launchClassicCrvUSDMonitoring');
    await launchClassicCrvUSDMonitoring();
    console.log('starting launchPegkeeper');
    await launchPegkeeper();
    // histo
    // await getLogsForBlock(22003575);
    console.log('boot complete');
}
await main();
// await telegramBotMain(ENV, bot);
// await launchClassicCrvUSDMonitoring();
// await conductResearch();
//# sourceMappingURL=crvUSD_Bot.js.map