import { ADDRESS_crvUSD_ControllerFactory } from '../Constants.js';
import { handleLiveEvents, manageMarket, watchingForNewMarketOpenings } from '../Oragnizer.js';
import { ABI_crvUSD_ControllerFactory } from '../abis/ABI_crvUSD_ControllerFactory.js';
import { livemodePegKeepers } from '../pegkeeper/Pegkeeper.js';
import { getCurrentBlockNumber, getPastEvents } from '../web3Calls/generic.js';
import { WEB3_WS_PROVIDER } from '../web3connections.js';
export async function launchClassicCrvUSDMonitoring() {
    const crvUSD_ControllerFactory = new WEB3_WS_PROVIDER.eth.Contract(ABI_crvUSD_ControllerFactory, ADDRESS_crvUSD_ControllerFactory);
    const crvUSD_LAUNCH_BLOCK = 17257955;
    const PRESENT = await getCurrentBlockNumber();
    await livemodePegKeepers(PRESENT);
    // await pegkeeperHisto(19046609, 19096615);
    const ADDED_MARKET_EVENTS = await getPastEvents(crvUSD_ControllerFactory, 'AddMarket', crvUSD_LAUNCH_BLOCK, PRESENT);
    if (!(ADDED_MARKET_EVENTS instanceof Array))
        return;
    for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
        await manageMarket(MARKET_CREATION);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await watchingForNewMarketOpenings(crvUSD_ControllerFactory);
    await handleLiveEvents();
    console.log('crvUSD_Bot launched successfully.');
}
//# sourceMappingURL=main.js.map