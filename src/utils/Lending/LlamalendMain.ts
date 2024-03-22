import { EnrichedLendingMarketEvent, EthereumEvent, LendingMarketEvent, LendingMarketEventPayload } from "../Interfaces.js";
import { getBorrowApr, getCollatDollarValue, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket } from "../helperFunctions/Lending.js";
import { web3HttpProvider, webWsProvider } from "../helperFunctions/Web3.js";
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
import { ABI_LLAMALEND_AMM, ABI_LLAMALEND_CONTROLLER, ABI_LLAMALEND_FACTORY, ABI_LLAMALEND_VAULT } from "./Abis.js";
import { enrichMarketData, filterForOnly, handleEvent } from "./Helper.js";

async function processLlamalendVaultEvent(market: EnrichedLendingMarketEvent, llamalendVaultContract: any, controllerContract: any, event: any, eventEmitter: any): Promise<void> {
  const txHash = event.transactionHash;
  if (event.event === "Deposit") {
    const agentAddress = event.returnValues.sender;
    const parsedDepositedCollateralAmount = event.returnValues.assets / 10 ** Number(market.collateral_token_decimals);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
    const message = buildLendingMarketDepositMessage(market, txHash, agentAddress, parsedDepositedCollateralAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket);
    console.log("Sending Message (Via processLlamalendVaultEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "Withdraw") {
    const agentAddress = event.returnValues.sender;
    const parsedAmount = event.returnValues.assets / 10 ** Number(market.borrowed_token_decimals);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
    const message = buildLendingMarketWithdrawMessage(market, txHash, agentAddress, parsedAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket);
    console.log("Sending Message (Via processLlamalendVaultEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function processLlamalendControllerEvent(
  market: EnrichedLendingMarketEvent,
  llamalendVaultContract: any,
  controllerContract: any,
  ammContract: any,
  event: any,
  eventEmitter: any
) {
  if (!["Borrow", "Repay", "RemoveCollateral", "Liquidate"].includes(event.event)) return;

  const txHash = event.transactionHash;
  const agentAddress = event.returnValues.user;
  const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
  const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
  const collatDollarValue = await getCollatDollarValue(market, ammContract, event.blockNumber);
  const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
  const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
  const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);

  if (event.event === "Borrow") {
    const parsedBorrowedAmount = event.returnValues.loan_increase / 10 ** Number(market.borrowed_token_decimals);
    const parsedCollatAmount = event.returnValues.collateral_increase / 10 ** Number(market.collateral_token_decimals);
    const collatDollarAmount = collatDollarValue * parsedCollatAmount;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const dollarAmountBorrow = parsedBorrowedAmount * crvUSDPrice!;
    const message = buildLendingMarketBorrowMessage(
      market,
      txHash,
      agentAddress,
      parsedBorrowedAmount,
      parsedCollatAmount,
      positionHealth,
      totalDebtInMarket,
      collatDollarAmount,
      dollarAmountBorrow,
      borrowApr,
      lendApr,
      totalAssets
    );
    console.log("Sending Message (Via processLlamalendControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "Repay") {
    const parsedRepayAmount = event.returnValues.loan_decrease / 10 ** Number(market.borrowed_token_decimals);
    const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
    const collatDollarAmount = collatDollarValue * parsedCollatAmount;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const repayDollarAmount = parsedRepayAmount * crvUSDPrice!;
    const message = buildLendingMarketRepayMessage(
      market,
      txHash,
      positionHealth,
      totalDebtInMarket,
      agentAddress,
      parsedRepayAmount,
      collatDollarAmount,
      parsedCollatAmount,
      repayDollarAmount,
      borrowApr,
      lendApr,
      totalAssets
    );
    console.log("Sending Message (Via processLlamalendControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
  if (event.event === "RemoveCollateral") {
    const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
    const collatDollarAmount = collatDollarValue * parsedCollatAmount;
    const message = buildLendingMarketRemoveCollateralMessage(
      market,
      parsedCollatAmount,
      txHash,
      agentAddress,
      positionHealth,
      collatDollarAmount,
      totalDebtInMarket,
      borrowApr,
      lendApr,
      totalAssets
    );
    console.log("Sending Message (Via processLlamalendControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }

  // HARD-LIQUIDATION
  if (event.event === "Liquidate") {
    const liquidatorAddress = event.returnValues.liquidator;
    const poorFellaAddress = event.returnValues.user;
    const message = buildLendingMarketHardLiquidateMessage(market, txHash, totalDebtInMarket, borrowApr, lendApr, totalAssets, liquidatorAddress, poorFellaAddress);
    console.log("Sending Message (Via processLlamalendControllerEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function processLlamalendAmmEvent(market: EnrichedLendingMarketEvent, llamalendVaultContract: any, controllerContract: any, ammContract: any, event: any, eventEmitter: any) {
  if (event.event === "TokenExchange") {
    console.log("Soft Liquidation spotted");
    console.log("\n\n new Event in LLAMMA_CRVUSD_AMM:", event);

    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.buyer;
    let parsedSoftLiquidatedAmount;
    let parsedRepaidAmount;
    if (event.returnValues.sold_id === "0") {
      parsedSoftLiquidatedAmount = event.returnValues.tokens_bought / 10 ** market.borrowed_token_decimals;
      parsedRepaidAmount = event.returnValues.tokens_sold / 10 ** market.collateral_token_decimals;
    } else {
      parsedSoftLiquidatedAmount = event.returnValues.tokens_sold / 10 ** market.collateral_token_decimals;
      parsedRepaidAmount = event.returnValues.tokens_bought / 10 ** market.borrowed_token_decimals;
    }
    const collatDollarValue = await getCollatDollarValue(market, ammContract, event.blockNumber);
    const collatDollarAmount = collatDollarValue * parsedSoftLiquidatedAmount;
    const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    const repaidBorrrowTokenDollarAmount = parsedRepaidAmount * crvUSDPrice!;
    const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);

    const message = buildSoftLiquidateMessage(
      market,
      txHash,
      agentAddress,
      parsedSoftLiquidatedAmount,
      collatDollarAmount,
      parsedRepaidAmount,
      repaidBorrrowTokenDollarAmount,
      borrowApr,
      lendApr,
      totalDebtInMarket,
      totalAssets
    );
    console.log("Sending Message (Via processLlamalendAmmEvent)");
    eventEmitter.emit("newMessage", message);
  }
}

async function getAllLendingMarkets(): Promise<LendingMarketEvent[]> {
  // const LENDING_LAUNCH_BLOCK_V1 = 19290923; // v1
  const LENDING_LAUNCH_BLOCK = 19415827; // v2

  const PRESENT = await getCurrentBlockNumber();

  const llamalendFactory = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_FACTORY, llamalendFactoryAddress);
  const result = await getPastEvents(llamalendFactory, "NewVault", LENDING_LAUNCH_BLOCK, PRESENT);

  let events: EthereumEvent[] = [];

  if (Array.isArray(result)) {
    events = result as EthereumEvent[];
  } else {
    return [];
  }

  const lendingMarkets: LendingMarketEvent[] = await Promise.all(events.map((event) => handleEvent(event)));
  lendingMarkets.sort((a, b) => a.id.localeCompare(b.id));

  return lendingMarkets;
}

async function histoMode(allLendingMarkets: EnrichedLendingMarketEvent[], eventEmitter: any) {
  // const LENDING_LAUNCH_BLOCK_V1 = 19290923; // v1
  const LENDING_LAUNCH_BLOCK = 19415827; // v2
  const PRESENT = await getCurrentBlockNumber();

  // const START_BLOCK = LENDING_LAUNCH_BLOCK;
  // const END_BLOCK = PRESENT;

  const START_BLOCK = 19486981;
  const END_BLOCK = 19486981;

  console.log("start");

  for (const market of allLendingMarkets) {
    // used to filter for only 1 market to speed up debugging, works for address of vault, controller, or amm
    // if (!filterForOnly("0x044aC5160e5A04E09EBAE06D786fc151F2BA5ceD", market)) continue;

    // console.log("\nmarket", market);

    const vaultContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, market.vault);
    const controllerContact = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, market.controller);
    const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);

    const pastEventsVault = await getPastEvents(vaultContract, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(pastEventsVault)) {
      for (const event of pastEventsVault) {
        await processLlamalendVaultEvent(market, vaultContract, controllerContact, event, eventEmitter);
        console.log("\n\n new Event in Vault:", event);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const pastEventsController = await getPastEvents(controllerContact, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(pastEventsController)) {
      for (const event of pastEventsController as EthereumEvent[] as EthereumEvent[]) {
        console.log("\n\n new Event in Controller:", event);
        await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const pastEventsAmm = await getPastEvents(ammContract, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(pastEventsAmm)) {
      for (const event of pastEventsAmm as EthereumEvent[]) {
        console.log("\n\n new Event in Amm:", event);
        await processLlamalendAmmEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  console.log("done");
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit();
}

async function liveMode(allLendingMarkets: EnrichedLendingMarketEvent[], eventEmitter: any) {
  await checkWsConnectionViaNewBlocks();

  for (const market of allLendingMarkets) {
    console.log("\nmarket", market);

    const vaultContract = new webWsProvider.eth.Contract(ABI_LLAMALEND_VAULT, market.vault);
    const controllerContact = new webWsProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, market.controller);
    const ammContract = new webWsProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);

    subscribeToLendingMarketsEvents(market, vaultContract, controllerContact, ammContract, eventEmitter, "Vault");
    subscribeToLendingMarketsEvents(market, vaultContract, controllerContact, ammContract, eventEmitter, "Controller");
    subscribeToLendingMarketsEvents(market, vaultContract, controllerContact, ammContract, eventEmitter, "Amm");
  }

  eventEmitter.on("newLendingMarketsEvent", async ({ market, event, type, vaultContract, controllerContact, ammContract }: LendingMarketEventPayload) => {
    console.log("\n\n\n\nnew event in lending market:", market.vault, ":", event, "type:", type);
    if (type === "Vault") {
      await processLlamalendVaultEvent(market, vaultContract, controllerContact, event, eventEmitter);
    } else if (type === "Controller") {
      await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
    } else if (type === "Amm") {
      await processLlamalendAmmEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
    }
  });
}

// Markets: (v1)
// const llamalendFactoryAddress = "0xc67a44D958eeF0ff316C3a7c9E14FB96f6DedAA3"; // v1

const VAULT_CRV_LONG_ADDRESS = "0x67A18c18709C09D48000B321c6E1cb09F7181211";
const AMM_CRV_LONG_ADDRESS = "0xafC1ab86045Cb2a07C23399dbE64b56D1B8B3239";
const CONTROLLER_CRV_LONG_ADDRESS = "0x7443944962D04720f8c220C0D25f56F869d6EfD4";
const GAUGE_VAULT_CRV_LONG_ADDRESS = "0xAA90BE8bd52aeA49314dFc6e385e21A4e9c4ea0c";

const VAULT_wstETH_LONG_ADDRESS = "0xE21C518a09b26Bf65B16767B97249385f12780d9";
const AMM_wstETH_LONG_ADDRESS = "0x0167B8a9A3959E698A3e3BCaFe829878FfB709e3";
const CONTROLLER_VAULT_wstETH_LONG_ADDRESS = "0x5E657c5227A596a860621C5551c9735d8f4A8BE3";
const GAUGE_VAULT_wstETH_LONG_ADDRESS = "0x3742aCa9ad8655d2d3eab5569eF1BdB4C5d52e5D";

const VAULT_CRV_SHORT_ADDRESS = "0x044aC5160e5A04E09EBAE06D786fc151F2BA5ceD";
const AMM_CRV_SHORT_ADDRESS = "0x93e8F1F0e322c92E3cA3d2399823214991b47CB5";
const CONTROLER_VAULT_CRV_SHORT_ADDRESS = "0x43fc0f246F952ff12B757341A91cF4040711dDE9";
const GAUGE_VAULT_CRV_SHORT_ADDRESS = "0x270100d0D9D26E16F458cC4F71224490Ebc8F234";

// Markets: (v3)
const llamalendFactoryAddress = "0xeA6876DDE9e3467564acBeE1Ed5bac88783205E0"; // v3

// todo

export async function launchCurveLendingMonitoring(eventEmitter: any) {
  const allLendingMarkets = await getAllLendingMarkets();
  const allEnrichedLendingMarkets = await enrichMarketData(allLendingMarkets);
  if (!allEnrichedLendingMarkets) {
    console.log("Failed to boot LLamma Lend Markets, stopping!");
    return;
  }
  // console.log("allEnrichedLendingMarkets", allEnrichedLendingMarkets);

  // await histoMode(allEnrichedLendingMarkets, eventEmitter);
  await liveMode(allEnrichedLendingMarkets, eventEmitter);
}
