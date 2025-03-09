import { ABI_Controller } from '../utils/abis/ABI_Controller.js';
import { ABI_crvUSD_ControllerFactory } from '../utils/abis/ABI_crvUSD_ControllerFactory.js';
import { ABI_Fleshlender } from '../utils/abis/ABI_Fleshlender.js';
import { ABI_hacked_Transfer } from '../utils/abis/ABI_Hacked.js';
import { getDecimalFromCheatSheet, getSymbolFromCheatSheet } from '../utils/CollatCheatSheet.js';
import { ADDRESS_crvUSD_ControllerFactory } from '../utils/Constants.js';
import { getPastEvents, web3HttpProvider } from '../utils/web3/Web3Basics.js';

async function handleMarket(market: any, startBlock: number, endBlock: number, fleshlending_events: any) {
  const collateralAddress = market.returnValues.collateral;
  const controllerAddress = market.returnValues.controller;
  const AMM_ADDRESS = market.returnValues.amm;
  const CONTROLLER_CONTRACT = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);

  const PAST_EVENTS_crvUSD_CONTROLLER = await getPastEvents(CONTROLLER_CONTRACT, 'allEvents', startBlock, endBlock);
  if (!(PAST_EVENTS_crvUSD_CONTROLLER instanceof Array)) return;

  if (!(fleshlending_events instanceof Array)) return;

  for (const CONTROLLER_EVENT of PAST_EVENTS_crvUSD_CONTROLLER) {
    if ((CONTROLLER_EVENT as { event: string }).event === 'Borrow') {
      const formattedEventData = await handleBorrowEvent(
        CONTROLLER_EVENT,
        controllerAddress,
        collateralAddress,
        AMM_ADDRESS,
        fleshlending_events,
        PAST_EVENTS_crvUSD_CONTROLLER
      );
      const user = (
        CONTROLLER_EVENT as {
          returnValues: any;
        }
      ).returnValues.user;
      if (!formattedEventData) continue;
      const loanIncrease = Number(formattedEventData.loan_increase);
      if (userLoanMap.has(user.toLowerCase())) {
        userLoanMap.set(user.toLowerCase(), userLoanMap.get(user.toLowerCase())! + loanIncrease);
      } else {
        userLoanMap.set(user.toLowerCase(), loanIncrease);
      }
      // console.log('formattedEventData', formattedEventData);
      // todo
    }
  }
}

async function checkCollateralAddedWithoutRepay(event: any, PAST_EVENTS_crvUSD_CONTROLLER: any[]): Promise<boolean> {
  const blockNumber = event.blockNumber;
  const buyer = event.returnValues.user;

  // Filter events for the same buyer
  const buyerEvents = PAST_EVENTS_crvUSD_CONTROLLER.filter(
    (controllerEvent: any) => controllerEvent.returnValues?.user === buyer
  );

  // Start checking from the given block number
  for (const currentEvent of buyerEvents) {
    if (currentEvent.blockNumber <= blockNumber) continue;

    if (
      currentEvent.event === 'Borrow' &&
      Number(currentEvent.returnValues.collateral_increase / 1e18) > 0 &&
      Number(currentEvent.returnValues.loan_increase) === 0
    ) {
      // Check if there is a "Repay" event between `event.blockNumber` and `currentEvent.blockNumber`
      const hasRepayInBetween = buyerEvents.some(
        (intermediateEvent: any) =>
          intermediateEvent.event === 'Repay' &&
          intermediateEvent.blockNumber > blockNumber &&
          intermediateEvent.blockNumber < currentEvent.blockNumber
      );

      // If no "Repay" event is found in between, return true
      if (!hasRepayInBetween) {
        return true;
      }
    }
  }

  // No valid case found
  return false;
}

async function handleBorrowEvent(
  event: any,
  controllerAddress: string,
  collateralAddress: string,
  AMM_ADDRESS: string,
  fleshlending_events: any,
  PAST_EVENTS_crvUSD_CONTROLLER: any[]
) {
  const txHash = event.transactionHash;
  const buyer = event.returnValues.user;
  const blockNumber = event.blockNumber;

  let loan_increase = event.returnValues.loan_increase;
  loan_increase /= 1e18;
  loan_increase = Number(Number(loan_increase).toFixed(0));
  if (loan_increase === 0) return null;

  let collateral_increase = event.returnValues.collateral_increase;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_increase /= 10 ** collateralDecimals;
  collateral_increase = Number(collateral_increase);

  let collateralName = getSymbolFromCheatSheet(collateralAddress);

  // Check for matching blockNumber in fleshlending_events
  const matchingFlashLendingEvent = fleshlending_events.find(
    (flashEvent: any) => flashEvent.blockNumber === blockNumber
  );

  let leveragedViaFlashloan = false;

  if (matchingFlashLendingEvent) {
    const flashLoanedAmount = Number((matchingFlashLendingEvent.returnValues.amount / 1e18).toFixed(0));
    if (flashLoanedAmount === loan_increase) leveragedViaFlashloan = true;
  }

  let leveragedViaZap = false;
  const collatContract = new web3HttpProvider.eth.Contract(ABI_hacked_Transfer, collateralAddress);
  const collatTransfersInBlock = await getPastEvents(collatContract, 'Transfer', blockNumber, blockNumber);
  if (!(collatTransfersInBlock instanceof Array)) return;
  const countAmmCollatReceivals = collatTransfersInBlock.filter(
    (event: any) => event?.['returnValues']?.['receiver']?.toLowerCase() === AMM_ADDRESS.toLowerCase()
  ).length;
  if (countAmmCollatReceivals >= 2) leveragedViaZap = true;

  const manualLev = await checkCollateralAddedWithoutRepay(event, PAST_EVENTS_crvUSD_CONTROLLER);

  totalMinted += loan_increase;
  if (leveragedViaZap) mintedViaLevZap += loan_increase;
  if (leveragedViaFlashloan) mintedViaLevFlashloan += loan_increase;
  if (manualLev) mintedViaManualLev += loan_increase;

  return {
    blockNumber,
    loan_increase,
    collateralName,
    txHash,
    buyer,
    leveragedViaFlashloan,
    leveragedViaZap,
    manualLev,
  };
}

let totalMinted = 0;
let mintedViaLevZap = 0;
let mintedViaLevFlashloan = 0;
let mintedViaManualLev = 0;

let userLoanMap = new Map<string, number>();

export async function checkTokenFlow() {
  console.time();
  const startBlock = 21303934;
  const endBlock = 21508167;

  //   const startBlock = 21480653;
  //   const endBlock = startBlock;

  const crvUSD_ControllerFactory = new web3HttpProvider.eth.Contract(
    ABI_crvUSD_ControllerFactory,
    ADDRESS_crvUSD_ControllerFactory
  );

  const crvUSD_LAUNCH_BLOCK = 17257955;
  const currentBlockNumber = await web3HttpProvider.eth.getBlockNumber();

  const fleshlenderAddress = '0xA7a4bb50AF91f90b6fEb3388E7f8286aF45b299B';
  const FLASHLENDER_CONTRACT = new web3HttpProvider.eth.Contract(ABI_Fleshlender, fleshlenderAddress);
  const FLASHLENDING_EVENTS = await getPastEvents(
    FLASHLENDER_CONTRACT,
    'FlashLoan',
    crvUSD_LAUNCH_BLOCK,
    currentBlockNumber
  );

  const ADDED_MARKET_EVENTS = await getPastEvents(
    crvUSD_ControllerFactory,
    'AddMarket',
    crvUSD_LAUNCH_BLOCK,
    currentBlockNumber
  );
  if (!(ADDED_MARKET_EVENTS instanceof Array)) return;
  for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
    await handleMarket(MARKET_CREATION, startBlock, endBlock, FLASHLENDING_EVENTS);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Total minted: ${totalMinted}`);
  console.log(`Minted via leveraged zap: ${mintedViaLevZap}`);
  console.log(`Minted via leveraged flashloan: ${mintedViaLevFlashloan}`);
  console.log(`Manually Leveraged crvUSD: ${mintedViaManualLev}`);

  // Convert Map to array and sort by loan amount
  const sortedUserLoans = Array.from(userLoanMap.entries())
    .map(([user, loan]) => ({ user, loan }))
    .sort((a, b) => b.loan - a.loan);

  // Save to JSON file
  const fs = await import('fs/promises');
  const jsonFilePath = './userLoanData.json';
  await fs.writeFile(jsonFilePath, JSON.stringify(sortedUserLoans, null, 2), 'utf-8');
  console.log(`User loan data saved to ${jsonFilePath}`);

  console.log('Research complete.');
  console.timeEnd();
}
