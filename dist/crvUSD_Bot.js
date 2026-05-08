import { getTgBot, telegramBotMain } from './utils/telegram/TelegramBot.js';
import { launchCurveLendingMonitoring } from './utils/Lending/LlamalendMain.js';
import { launchClassicCrvUSDMonitoring } from './utils/ClassicCrvUSD/main.js';
import { startListeningToAllEvents } from './utils/web3/AllEvents.js';
import { launchPegkeeper } from './utils/pegkeeper/Pegkeeper.js';
console.clear();
const ENV = 'prod';
// const ENV = 'test';
async function main() {
    console.time('launching crvUSD_Bot');
    const bot = getTgBot(ENV);
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
    console.timeEnd('launching crvUSD_Bot');
    // histo
    // await getLogsForBlock(25051992);
}
// const bot = getTgBot(ENV);
// await telegramBotMain(ENV, bot);
await main();
// await launchClassicCrvUSDMonitoring();
// await conductResearch();
// await launchPegkeeper();
//# sourceMappingURL=crvUSD_Bot.js.map