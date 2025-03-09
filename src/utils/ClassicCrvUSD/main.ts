import { ADDRESS_crvUSD_ControllerFactory } from '../Constants.js';
import { handleLiveEvents, manageMarket, watchingForNewMarketOpenings } from '../Oragnizer.js';
import { ABI_crvUSD_ControllerFactory } from '../abis/ABI_crvUSD_ControllerFactory.js';
import { livemodePegKeepers } from '../pegkeeper/Pegkeeper.js';
import { getPastEvents, web3HttpProvider } from '../web3/Web3Basics.js';

export async function launchPegkeeper() {
  const currentBlockNumber = await web3HttpProvider.eth.getBlockNumber();
  await livemodePegKeepers(currentBlockNumber);
  // await pegkeeperHisto(19046609, 19096615);
}

export async function launchClassicCrvUSDMonitoring() {
  const crvUSD_ControllerFactory = new web3HttpProvider.eth.Contract(
    ABI_crvUSD_ControllerFactory,
    ADDRESS_crvUSD_ControllerFactory
  );

  const crvUSD_LAUNCH_BLOCK = 17257955;
  const currentBlockNumbe = await web3HttpProvider.eth.getBlockNumber();

  const ADDED_MARKET_EVENTS = await getPastEvents(
    crvUSD_ControllerFactory,
    'AddMarket',
    crvUSD_LAUNCH_BLOCK,
    currentBlockNumbe
  );
  if (!(ADDED_MARKET_EVENTS instanceof Array)) return;
  for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
    await manageMarket(MARKET_CREATION);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await watchingForNewMarketOpenings(ADDRESS_crvUSD_ControllerFactory, ABI_crvUSD_ControllerFactory);
  await handleLiveEvents();
  console.log('crvUSD_Bot launched successfully.');
}
