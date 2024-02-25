import { getBorrowApr, getCollatDollarValue, getCollateralTokenAddress, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket } from "../helperFunctions/Lending.js";
import { getWeb3HttpProvider, getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { getCoinSymbol } from "../pegkeeper/Pegkeeper.js";
import { getPriceOf_crvUSD } from "../priceAPI/priceAPI.js";
import {
  buildLendingMarketBorrowMessage,
  buildLendingMarketDepositMessage,
  buildLendingMarketHardLiquidateMessage,
  buildLendingMarketRemoveCollateralMessage,
  buildLendingMarketRepayMessage,
  buildLendingMarketWithdrawMessage,
  buildSoftLiquidateMessage,
} from "../telegram/TelegramBot.js";
import { checkWsConnectionViaNewBlocks, getCurrentBlockNumber, getPastEvents, subscribeToLendingMarketsEvents } from "../web3Calls/generic.js";
import {
  ABI_CONTROLER_VAULT_CRV_SHORT,
  ABI_CONTROLLER_CRV_LONG,
  ABI_LLAMMA_LENDING_AMM,
  ABI_VAULT_CRV_LONG,
  ABI_VAULT_CRV_SHORT,
  ABI_VAULT_wstETH_LONG,
  CONTROLLER_ABI_VAULT_wstETH_LONG,
} from "./Abis.js";

interface LendingMarketEventPayload {
  event: any;
  type: "Vault" | "Controller" | "Amm";
  contract: any;
  lendingMarketAddress: string;
}

async function processSingleVaultEvent(lendingMarketContract: any, lendingMarketAddress: string, event: any, eventEmitter: any): Promise<void> {
  console.log("event.event", event.event, event);
  if (event.event === "Deposit") {
    const txHash = event.transactionHash;
    const AGENT = event.returnValues.sender;
    const PARSED_DEPOSIT_AMOUNT = event.returnValues.assets / 1e18;
    const BORROW_APR = await getBorrowApr(lendingMarketContract, event.blockNumber);
    const LEND_APR = await getLendApr(lendingMarketContract, event.blockNumber);
    const TOTAL_ASSETS = await getTotalAssets(lendingMarketContract, event.blockNumber);
    const message = buildLendingMarketDepositMessage(lendingMarketAddress, txHash, AGENT, PARSED_DEPOSIT_AMOUNT, BORROW_APR, LEND_APR, TOTAL_ASSETS);
    console.log("Sending Message (Via processSingleVaultEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "Withdraw") {
    // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
    const txHash = event.transactionHash;
    const message = buildLendingMarketWithdrawMessage(txHash);
    console.log("Sending Message (Via processSingleVaultEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function processSingleControllerEvent(controllerContract: any, lendingMarketAddress: string, event: any, eventEmitter: any) {
  let web3 = getWeb3HttpProvider();

  if (event.event === "Borrow") {
    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.user;
    const parsedBorrowedAmount = event.returnValues.loan_increase / 1e18;
    const parsedCollatAmount = event.returnValues.collateral_increase / 1e18;
    const collatAddress = await getCollateralTokenAddress(controllerContract);
    const collatName = await getCoinSymbol(collatAddress, web3);
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
    const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
    const collatDollarAmount = collatDollarValue * parsedCollatAmount;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const dollarAmountBorrow = parsedBorrowedAmount * crvUSDPrice!;
    const message = buildLendingMarketBorrowMessage(
      txHash,
      agentAddress,
      parsedBorrowedAmount,
      parsedCollatAmount,
      collatName!,
      collatAddress,
      positionHealth,
      lendingMarketAddress,
      totalDebtInMarket,
      collatDollarAmount,
      dollarAmountBorrow
    );
    console.log("Sending Message (Via processSingleControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "Repay") {
    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.user;
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
    const parsedRepayAmount = event.returnValues.loan_decrease / 1e18;
    const collatAddress = await getCollateralTokenAddress(controllerContract);
    const collatName = await getCoinSymbol(collatAddress, web3);
    const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
    const parsedCollatAmount = event.returnValues.collateral_decrease / 1e18;
    const collatDollarAmount = collatDollarValue * parsedCollatAmount;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const repayDollarAmount = parsedRepayAmount * crvUSDPrice!;
    const message = buildLendingMarketRepayMessage(
      txHash,
      lendingMarketAddress,
      positionHealth,
      totalDebtInMarket,
      agentAddress,
      parsedRepayAmount,
      collatName!,
      collatAddress,
      collatDollarAmount,
      parsedCollatAmount,
      repayDollarAmount
    );
    console.log("Sending Message (Via processSingleControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "RemoveCollateral") {
    const txHash = event.transactionHash;
    const parsedCollatRemovalAmount = event.returnValues.collateral_decrease / 1e18;
    const agentAddress = event.returnValues.user;
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
    const collatDollarAmount = collatDollarValue * parsedCollatRemovalAmount;
    const collatAddress = await getCollateralTokenAddress(controllerContract);
    const collatName = await getCoinSymbol(collatAddress, web3);
    const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
    const message = buildLendingMarketRemoveCollateralMessage(
      parsedCollatRemovalAmount,
      txHash,
      lendingMarketAddress,
      agentAddress,
      positionHealth,
      collatDollarAmount,
      collatAddress,
      collatName!,
      totalDebtInMarket
    );
    console.log("Sending Message (Via processSingleControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }

  // HARD-LIQUIDATION
  if (event.event === "Liquidate") {
    // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
    const txHash = event.transactionHash;
    const message = buildLendingMarketHardLiquidateMessage(txHash);
    console.log("Sending Message (Via processSingleControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function processSingleAmmEvent(controllerContract: any, lendingMarketAddress: string, event: any, eventEmitter: any) {
  if (event.event === "TokenExchange") {
    console.log("Soft Liquidation spotted");
    console.log("\n\n new Event in LLAMMA_CRVUSD_AMM:", event);

    let web3 = getWeb3HttpProvider();
    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.buyer;
    const parsedSoftLiquidatedAmount = event.returnValues.tokens_bought / 1e18;
    const collatAddress = await getCollateralTokenAddress(controllerContract);
    const collatName = await getCoinSymbol(collatAddress, web3);
    const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
    const collatDollarAmount = collatDollarValue * parsedSoftLiquidatedAmount;
    const parsedRepaidAmount = event.returnValues.tokens_sold / 1e18;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const repaidCrvUSDDollarAmount = parsedRepaidAmount * crvUSDPrice!;
    const message = buildSoftLiquidateMessage(
      txHash,
      lendingMarketAddress,
      agentAddress,
      parsedSoftLiquidatedAmount,
      collatAddress,
      collatName!,
      collatDollarAmount,
      parsedRepaidAmount,
      repaidCrvUSDDollarAmount
    );
    console.log("Sending Message (Via processSingleAmmEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function histoMode(eventEmitter: any) {
  let web3 = getWeb3HttpProvider();

  const LENDING_LAUNCH_BLOCK = 19290923;
  const PRESENT = await getCurrentBlockNumber();

  const START_BLOCK = LENDING_LAUNCH_BLOCK;
  const END_BLOCK = PRESENT;

  // const START_BLOCK = 19298210;
  // const END_BLOCK = 19298210;

  // ###################################################### CRV LONG #######################################################
  // const VAULT_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS);
  // const PAST_EVENTS_VAULT_CRV_LONG = await getPastEvents(VAULT_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_VAULT_CRV_LONG)) {
  //   for (const event of PAST_EVENTS_VAULT_CRV_LONG) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleVaultEvent(VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
  //     console.log("\n\n new Event in VAULT_CRV_LONG:", event);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const CONTROLLER_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_CONTROLLER_CRV_LONG, CONTROLLER_CRV_LONG_ADDRESS);
  // const PAST_EVENTS_CONTROLLER_CRV_LONG = await getPastEvents(CONTROLLER_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_CONTROLLER_CRV_LONG)) {
  //   for (const event of PAST_EVENTS_CONTROLLER_CRV_LONG as EthereumEvent[]) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     console.log("\n\n new Event in CONTROLLER_CRV_LONG:", event);
  //     await processSingleControllerEvent(CONTROLLER_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const LLAMMA_CRVUSD_AMM_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_CRV_LONG_ADDRESS);
  // const PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG = await getPastEvents(LLAMMA_CRVUSD_AMM_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG)) {
  //   for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleAmmEvent(CONTROLLER_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // ###################################################### wstETH LONG #######################################################
  // const VAULT_wstETH_LONG = new Web3HttpProvider.eth.Contract(ABI_VAULT_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS);
  // const PAST_EVENTS_VAULT_wstETH_LONG = await getPastEvents(VAULT_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_VAULT_wstETH_LONG)) {
  //   for (const event of PAST_EVENTS_VAULT_wstETH_LONG) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleVaultEvent(VAULT_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
  //     console.log("\n\n new Event in VAULT_wstETH_LONG:", event);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const CONTROLLER_wstETH_LONG = new Web3HttpProvider.eth.Contract(CONTROLLER_ABI_VAULT_wstETH_LONG, CONTROLLER_VAULT_wstETH_LONG_ADDRESS);
  // const PAST_EVENTS_CONTROLLER_wstETH_LONG = await getPastEvents(CONTROLLER_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_CONTROLLER_wstETH_LONG)) {
  //   for (const event of PAST_EVENTS_CONTROLLER_wstETH_LONG as EthereumEvent[]) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     console.log("\n\n new Event in CONTROLLER_wstETH_LONG:", event);
  //     await processSingleControllerEvent(CONTROLLER_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const LLAMMA_CRVUSD_AMM_wstETH_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_wstETH_LONG_ADDRESS);
  // const PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG = await getPastEvents(LLAMMA_CRVUSD_AMM_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG)) {
  //   for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleAmmEvent(CONTROLLER_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // ###################################################### CRV SHORT #######################################################
  // const VAULT_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_VAULT_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS);
  // const PAST_EVENTS_VAULT_CRV_SHORT = await getPastEvents(VAULT_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_VAULT_CRV_SHORT)) {
  //   for (const event of PAST_EVENTS_VAULT_CRV_SHORT) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleVaultEvent(VAULT_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
  //     console.log("\n\n new Event in VAULT_CRV_SHORT:", event);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const CONTROLLER_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_CONTROLER_VAULT_CRV_SHORT, CONTROLER_VAULT_CRV_SHORT_ADDRESS);
  // const PAST_EVENTS_CONTROLLER_CRV_SHORT = await getPastEvents(CONTROLLER_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_CONTROLLER_CRV_SHORT)) {
  //   for (const event of PAST_EVENTS_CONTROLLER_CRV_SHORT as EthereumEvent[]) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     console.log("\n\n new Event in CONTROLLER_CRV_SHORT:", event);
  //     await processSingleControllerEvent(CONTROLLER_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  // const LLAMMA_CRVUSD_AMM_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_CRV_SHORT_ADDRESS);
  // const PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT = await getPastEvents(LLAMMA_CRVUSD_AMM_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
  // if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT)) {
  //   for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT) {
  //     // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
  //     await processSingleAmmEvent(CONTROLLER_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
  //     await new Promise((resolve) => setTimeout(resolve, 500));
  //   }
  // }

  console.log("done");
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit();
}

async function liveMode(eventEmitter: any) {
  const WEB3_WS_PROVIDER = getWeb3WsProvider();
  await checkWsConnectionViaNewBlocks();

  // CRV LONG
  const VAULT_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(VAULT_CRV_LONG, eventEmitter, "Vault", VAULT_CRV_LONG_ADDRESS);

  // CRV LONG
  const CONTROLLER_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER_CRV_LONG, CONTROLLER_CRV_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(CONTROLLER_CRV_LONG, eventEmitter, "Controller", VAULT_CRV_LONG_ADDRESS);

  // CRV LONG
  const LLAMMA_CRVUSD_AMM_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_CRV_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_CRV_LONG, eventEmitter, "Amm", VAULT_CRV_LONG_ADDRESS);

  // wsETH LONG
  const VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(VAULT_wstETH_LONG, eventEmitter, "Vault", VAULT_wstETH_LONG_ADDRESS);

  // wsETH LONG
  const CONTROLLER_VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(CONTROLLER_ABI_VAULT_wstETH_LONG, CONTROLLER_VAULT_wstETH_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(CONTROLLER_VAULT_wstETH_LONG, eventEmitter, "Controller", VAULT_wstETH_LONG_ADDRESS);

  // wsETH LONG
  const LLAMMA_CRVUSD_AMM_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_wstETH_LONG_ADDRESS);
  subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_wstETH_LONG, eventEmitter, "Amm", VAULT_wstETH_LONG_ADDRESS);

  // CRV SHORT
  const VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS);
  subscribeToLendingMarketsEvents(VAULT_CRV_SHORT, eventEmitter, "Vault", VAULT_CRV_SHORT_ADDRESS);

  // CRV SHORT
  const CONTROLER_VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLER_VAULT_CRV_SHORT, CONTROLER_VAULT_CRV_SHORT_ADDRESS);
  subscribeToLendingMarketsEvents(CONTROLER_VAULT_CRV_SHORT, eventEmitter, "Controller", VAULT_CRV_SHORT_ADDRESS);

  // CRV SHORT
  const LLAMMA_CRVUSD_AMM_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMMA_LENDING_AMM, AMM_CRV_SHORT_ADDRESS);
  subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_CRV_SHORT, eventEmitter, "Amm", VAULT_CRV_SHORT_ADDRESS);

  eventEmitter.on("newLendingMarketsEvent", async ({ event, type, contract, lendingMarketAddress }: LendingMarketEventPayload) => {
    console.log("\n\n\n\nnew event in lending market:", lendingMarketAddress, ":", event, "type:", type, "contract", contract);
    if (type === "Vault") {
      await processSingleVaultEvent(contract, lendingMarketAddress, event, eventEmitter);
    } else if (type === "Controller") {
      await processSingleControllerEvent(contract, lendingMarketAddress, event, eventEmitter);
    } else if (type === "Amm") {
      await processSingleAmmEvent(contract, lendingMarketAddress, event, eventEmitter);
    }
  });
}

const LLAMMA_CRVUSD_AMM_ADDRESS = "0xafC1ab86045Cb2a07C23399dbE64b56D1B8B3239";
// const LLAMMA_CRVUSD_AMM_ADDRESS = "0x4f37395BdFbE3A0dca124ad3C9DbFe6A6cbc31D6"; ?

const crvUSD_CONTROLLER_ADDRESS = "0x5473B1BcBbC45d38d8fBb50a18a73aFb8B0637A7";
const VAULT_ADDRESS = "0x596F8E49acE6fC8e09B561972360DC216f1c2A1f";
const CryptoFromPool_ADDRESS = "0x9164e210d123e6566DaF113136a73684C4AB01e2";
const SEMI_LOG_MONETARY_POLICY_ADDRESS = "0xa7E98815c0193E01165720C3abea43B885ae67FD";
const LIQUIDITY_GAUGE_V6_ADDRESS = "0x00B71A425Db7C8B65a46CF39c23A188e10A2DE99";
const ONE_WAY_LENDING_FACTORY_ADDRESS = "0xc67a44D958eeF0ff316C3a7c9E14FB96f6DedAA3";

// Markets:
const VAULT_CRV_LONG_ADDRESS = "0x67A18c18709C09D48000B321c6E1cb09F7181211"; // txHit Mich deposit
const AMM_CRV_LONG_ADDRESS = "0xafC1ab86045Cb2a07C23399dbE64b56D1B8B3239";
const CONTROLLER_CRV_LONG_ADDRESS = "0x7443944962D04720f8c220C0D25f56F869d6EfD4"; // taking loans from controller
const GAUGE_VAULT_CRV_LONG_ADDRESS = "0xAA90BE8bd52aeA49314dFc6e385e21A4e9c4ea0c";

const VAULT_wstETH_LONG_ADDRESS = "0xE21C518a09b26Bf65B16767B97249385f12780d9";
const AMM_wstETH_LONG_ADDRESS = "0x0167B8a9A3959E698A3e3BCaFe829878FfB709e3";
const CONTROLLER_VAULT_wstETH_LONG_ADDRESS = "0x5E657c5227A596a860621C5551c9735d8f4A8BE3";
const GAUGE_VAULT_wstETH_LONG_ADDRESS = "0x3742aCa9ad8655d2d3eab5569eF1BdB4C5d52e5D";

const VAULT_CRV_SHORT_ADDRESS = "0x044aC5160e5A04E09EBAE06D786fc151F2BA5ceD";
const AMM_CRV_SHORT_ADDRESS = "0x93e8F1F0e322c92E3cA3d2399823214991b47CB5";
const CONTROLER_VAULT_CRV_SHORT_ADDRESS = "0x43fc0f246F952ff12B757341A91cF4040711dDE9";
const GAUGE_VAULT_CRV_SHORT_ADDRESS = "0x270100d0D9D26E16F458cC4F71224490Ebc8F234";

export async function launchCurveLendingMonitoring(eventEmitter: any) {
  // await histoMode(eventEmitter);
  await liveMode(eventEmitter);
}
