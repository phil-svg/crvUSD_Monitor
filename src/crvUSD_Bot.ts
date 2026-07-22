import { getTgBot, telegramBotMain } from './utils/telegram/TelegramBot.js';
import { launchCurveLendingMonitoring } from './utils/Lending/LlamalendMain.js';
import { launchClassicCrvUSDMonitoring } from './utils/ClassicCrvUSD/main.js';
import { getLogsForBlock, runHistoricalBlock, startListeningToAllEvents } from './utils/web3/AllEvents.js';
import { conductResearch } from './research/Research.js';
import { launchPegkeeper } from './utils/pegkeeper/Pegkeeper.js';
import { launchCurveLendingMonitoring_V2 } from './utils/LendingV2/LlamalendMain.js';
import { web3HttpProvider } from './utils/web3/Web3Basics.js';

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

  console.log('starting launchCurveLendingMonitoring_V2');
  await launchCurveLendingMonitoring_V2();

  // console.log('starting launchClassicCrvUSDMonitoring');
  // await launchClassicCrvUSDMonitoring();

  // console.log('starting launchPegkeeper');
  // await launchPegkeeper();

  // console.timeEnd('launching crvUSD_Bot');

  // histo
  // await getLogsForBlock(25580688);
}

// const bot = getTgBot(ENV);
// await telegramBotMain(ENV, bot);
await main();
// await launchCurveLendingMonitoring_V2();
// await launchClassicCrvUSDMonitoring();
// await conductResearch();
// await launchPegkeeper();

// await runHistoricalBlock(25585567); // requires main() to have booted
