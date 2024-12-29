import { ABI_Controller } from '../utils/abis/ABI_Controller.js';
import { ABI_crvUSD_ControllerFactory } from '../utils/abis/ABI_crvUSD_ControllerFactory.js';
import { ABI_Fleshlender } from '../utils/abis/ABI_Fleshlender.js';
import { ABI_hacked_Transfer } from '../utils/abis/ABI_Hacked.js';
import { getDecimalFromCheatSheet, getSymbolFromCheatSheet } from '../utils/CollatCheatSheet.js';
import { ADDRESS_crvUSD_ControllerFactory } from '../utils/Constants.js';
import { getCurrentBlockNumber, getPastEvents } from '../utils/web3Calls/generic.js';
import { WEB3_HTTP_PROVIDER } from '../utils/web3connections.js';
async function handleMarket(market, startBlock, endBlock, fleshlending_events) {
    const collateralAddress = market.returnValues.collateral;
    const controllerAddress = market.returnValues.controller;
    const AMM_ADDRESS = market.returnValues.amm;
    const CONTROLLER_CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Controller, controllerAddress);
    const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(CONTROLLER_CONTRACT, 'allEvents', startBlock, endBlock);
    if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array))
        return;
    if (!(fleshlending_events instanceof Array))
        return;
    for (const CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
        if (CONTROLLER_EVENT.event === 'Borrow') {
            const formattedEventData = await handleBorrowEvent(CONTROLLER_EVENT, controllerAddress, collateralAddress, AMM_ADDRESS, fleshlending_events);
            console.log('formattedEventData', formattedEventData);
            // todo
        }
    }
}
async function handleBorrowEvent(event, controllerAddress, collateralAddress, AMM_ADDRESS, fleshlending_events) {
    const txHash = event.transactionHash;
    const buyer = event.returnValues.user;
    const blockNumber = event.blockNumber;
    let loan_increase = event.returnValues.loan_increase;
    loan_increase /= 1e18;
    loan_increase = Number(Number(loan_increase).toFixed(0));
    let collateral_increase = event.returnValues.collateral_increase;
    let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
    collateral_increase /= 10 ** collateralDecimals;
    collateral_increase = Number(collateral_increase);
    let collateralName = getSymbolFromCheatSheet(collateralAddress);
    // Check for matching blockNumber in fleshlending_events
    const matchingFlashLendingEvent = fleshlending_events.find((flashEvent) => flashEvent.blockNumber === blockNumber);
    let leveragedViaFlashloan = false;
    if (matchingFlashLendingEvent) {
        const flashLoanedAmount = Number((matchingFlashLendingEvent.returnValues.amount / 1e18).toFixed(0));
        if (flashLoanedAmount === loan_increase)
            leveragedViaFlashloan = true;
    }
    let leveragedViaZap = false;
    const collatContract = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_hacked_Transfer, collateralAddress);
    const collatTransfersInBlock = await getPastEvents(collatContract, 'Transfer', blockNumber, blockNumber);
    if (!(collatTransfersInBlock instanceof Array))
        return;
    const countAmmCollatReceivals = collatTransfersInBlock.filter((event) => { var _a, _b; return ((_b = (_a = event === null || event === void 0 ? void 0 : event['returnValues']) === null || _a === void 0 ? void 0 : _a['receiver']) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === AMM_ADDRESS.toLowerCase(); }).length;
    if (countAmmCollatReceivals >= 2)
        leveragedViaZap = true;
    totalMinted += loan_increase;
    if (leveragedViaZap)
        mintedViaLevZap += loan_increase;
    if (leveragedViaFlashloan)
        mintedViaLevFlashloan += loan_increase;
    return {
        blockNumber,
        loan_increase,
        collateralName,
        txHash,
        buyer,
        leveragedViaFlashloan,
        leveragedViaZap,
    };
}
let totalMinted = 0;
let mintedViaLevZap = 0;
let mintedViaLevFlashloan = 0;
export async function checkTokenFlow() {
    console.time();
    const startBlock = 21303934;
    const endBlock = 21508167;
    //   const startBlock = 21480653;
    //   const endBlock = startBlock;
    const crvUSD_ControllerFactory = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD_ControllerFactory, ADDRESS_crvUSD_ControllerFactory);
    const crvUSD_LAUNCH_BLOCK = 17257955;
    const PRESENT = await getCurrentBlockNumber();
    const fleshlenderAddress = '0xA7a4bb50AF91f90b6fEb3388E7f8286aF45b299B';
    const FLASHLENDER_CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Fleshlender, fleshlenderAddress);
    const FLASHLENDING_EVENTS = await getPastEvents(FLASHLENDER_CONTRACT, 'FlashLoan', crvUSD_LAUNCH_BLOCK, PRESENT);
    const ADDED_MARKET_EVENTS = await getPastEvents(crvUSD_ControllerFactory, 'AddMarket', crvUSD_LAUNCH_BLOCK, PRESENT);
    if (!(ADDED_MARKET_EVENTS instanceof Array))
        return;
    for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
        await handleMarket(MARKET_CREATION, startBlock, endBlock, FLASHLENDING_EVENTS);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    //   console.log(`Total minted: ${totalMinted}`);
    //   console.log(`Minted via leveraged zap: ${mintedViaLevZap}`);
    //   console.log(`Minted via leveraged flashloan: ${mintedViaLevFlashloan}`);
    console.log('Research complete.');
    console.timeEnd();
}
//# sourceMappingURL=Flow.js.map