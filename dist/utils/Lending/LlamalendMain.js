import { getBorrowApr, getCollatDollarValue, getCollateralTokenAddress, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket } from "../helperFunctions/Lending.js";
import { getWeb3HttpProvider, getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { getCoinSymbol } from "../pegkeeper/Pegkeeper.js";
import { getPriceOf_crvUSD } from "../priceAPI/priceAPI.js";
import { buildLendingMarketBorrowMessage, buildLendingMarketDepositMessage, buildLendingMarketHardLiquidateMessage, buildLendingMarketRemoveCollateralMessage, buildLendingMarketRepayMessage, buildLendingMarketWithdrawMessage, buildSoftLiquidateMessage, } from "../telegram/TelegramBot.js";
import { checkWsConnectionViaNewBlocks, getCurrentBlockNumber, getPastEvents, subscribeToLendingMarketsEvents } from "../web3Calls/generic.js";
import { ABI_LLAMALEND_AMM, ABI_LLAMALEND_CONTROLLER, ABI_LLAMALEND_VAULT } from "./Abis.js";
async function processLlamalendVaultEvent(llamalendVaultContract, llamaLendVaultAddress, event, eventEmitter) {
    console.log("event.event", event.event, event);
    if (event.event === "Deposit") {
        const txHash = event.transactionHash;
        const agentAddress = event.returnValues.sender;
        const parsedDepositAmount = event.returnValues.assets / 1e18;
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(llamalendVaultContract, event.blockNumber);
        const message = buildLendingMarketDepositMessage(llamaLendVaultAddress, txHash, agentAddress, parsedDepositAmount, borrowApr, lendApr, totalAssets);
        console.log("Sending Message (Via processLlamalendVaultEvent)");
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Withdraw") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const txHash = event.transactionHash;
        const message = buildLendingMarketWithdrawMessage(txHash);
        console.log("Sending Message (Via processLlamalendVaultEvent)");
        eventEmitter.emit("newMessage", message);
    }
}
async function processLlamalendControllerEvent(controllerContract, llamaLendVaultAddress, event, eventEmitter) {
    let web3 = getWeb3HttpProvider();
    const llamalendVaultContract = new web3.eth.Contract(ABI_LLAMALEND_VAULT, llamaLendVaultAddress);
    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.user;
    const collatAddress = await getCollateralTokenAddress(controllerContract);
    const collatName = await getCoinSymbol(collatAddress, web3);
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
    const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    if (event.event === "Borrow") {
        const parsedBorrowedAmount = event.returnValues.loan_increase / 1e18;
        const parsedCollatAmount = event.returnValues.collateral_increase / 1e18;
        const collatDollarAmount = collatDollarValue * parsedCollatAmount;
        const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
        const dollarAmountBorrow = parsedBorrowedAmount * crvUSDPrice;
        const message = buildLendingMarketBorrowMessage(txHash, agentAddress, parsedBorrowedAmount, parsedCollatAmount, collatName, collatAddress, positionHealth, llamaLendVaultAddress, totalDebtInMarket, collatDollarAmount, dollarAmountBorrow, borrowApr, lendApr);
        console.log("Sending Message (Via processLlamalendControllerEvent)");
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Repay") {
        const parsedRepayAmount = event.returnValues.loan_decrease / 1e18;
        const parsedCollatAmount = event.returnValues.collateral_decrease / 1e18;
        const collatDollarAmount = collatDollarValue * parsedCollatAmount;
        const crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
        const repayDollarAmount = parsedRepayAmount * crvUSDPrice;
        const message = buildLendingMarketRepayMessage(txHash, llamaLendVaultAddress, positionHealth, totalDebtInMarket, agentAddress, parsedRepayAmount, collatName, collatAddress, collatDollarAmount, parsedCollatAmount, repayDollarAmount, borrowApr, lendApr);
        console.log("Sending Message (Via processLlamalendControllerEvent)");
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "RemoveCollateral") {
        const parsedCollatAmount = event.returnValues.collateral_decrease / 1e18;
        const collatDollarAmount = collatDollarValue * parsedCollatAmount;
        const message = buildLendingMarketRemoveCollateralMessage(parsedCollatAmount, txHash, llamaLendVaultAddress, agentAddress, positionHealth, collatDollarAmount, collatAddress, collatName, totalDebtInMarket, borrowApr, lendApr);
        console.log("Sending Message (Via processLlamalendControllerEvent)");
        eventEmitter.emit("newMessage", message);
    }
    // HARD-LIQUIDATION
    if (event.event === "Liquidate") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const message = buildLendingMarketHardLiquidateMessage(txHash);
        console.log("Sending Message (Via processLlamalendControllerEvent)");
        eventEmitter.emit("newMessage", message);
    }
}
async function processLlamalendAmmEvent(controllerContract, llamaLendVaultAddress, event, eventEmitter) {
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
        const repaidCrvUSDDollarAmount = parsedRepaidAmount * crvUSDPrice;
        const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
        const llamalendVaultContract = new web3.eth.Contract(ABI_LLAMALEND_VAULT, llamaLendVaultAddress);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const message = buildSoftLiquidateMessage(txHash, llamaLendVaultAddress, agentAddress, parsedSoftLiquidatedAmount, collatAddress, collatName, collatDollarAmount, parsedRepaidAmount, repaidCrvUSDDollarAmount, borrowApr, lendApr, totalDebtInMarket);
        console.log("Sending Message (Via processLlamalendAmmEvent)");
        eventEmitter.emit("newMessage", message);
    }
}
async function histoMode(eventEmitter) {
    let Web3HttpProvider = getWeb3HttpProvider();
    const LENDING_LAUNCH_BLOCK = 19290923;
    const PRESENT = await getCurrentBlockNumber();
    const START_BLOCK = LENDING_LAUNCH_BLOCK;
    const END_BLOCK = PRESENT;
    // const START_BLOCK = 19302429;
    // const END_BLOCK = 19302429;
    // ###################################################### CRV LONG #######################################################
    const VAULT_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_CRV_LONG_ADDRESS);
    const PAST_EVENTS_VAULT_CRV_LONG = await getPastEvents(VAULT_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_VAULT_CRV_LONG)) {
        for (const event of PAST_EVENTS_VAULT_CRV_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendVaultEvent(VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
            console.log("\n\n new Event in VAULT_CRV_LONG:", event);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const CONTROLLER_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLLER_CRV_LONG_ADDRESS);
    const PAST_EVENTS_CONTROLLER_CRV_LONG = await getPastEvents(CONTROLLER_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_CONTROLLER_CRV_LONG)) {
        for (const event of PAST_EVENTS_CONTROLLER_CRV_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            console.log("\n\n new Event in CONTROLLER_CRV_LONG:", event);
            await processLlamalendControllerEvent(CONTROLLER_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const LLAMMA_CRVUSD_AMM_CRV_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, AMM_CRV_LONG_ADDRESS);
    const PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG = await getPastEvents(LLAMMA_CRVUSD_AMM_CRV_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG)) {
        for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendAmmEvent(CONTROLLER_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    // ###################################################### wstETH LONG #######################################################
    const VAULT_wstETH_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_wstETH_LONG_ADDRESS);
    const PAST_EVENTS_VAULT_wstETH_LONG = await getPastEvents(VAULT_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_VAULT_wstETH_LONG)) {
        for (const event of PAST_EVENTS_VAULT_wstETH_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendVaultEvent(VAULT_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
            console.log("\n\n new Event in VAULT_wstETH_LONG:", event);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const CONTROLLER_wstETH_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLLER_VAULT_wstETH_LONG_ADDRESS);
    const PAST_EVENTS_CONTROLLER_wstETH_LONG = await getPastEvents(CONTROLLER_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_CONTROLLER_wstETH_LONG)) {
        for (const event of PAST_EVENTS_CONTROLLER_wstETH_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            console.log("\n\n new Event in CONTROLLER_wstETH_LONG:", event);
            await processLlamalendControllerEvent(CONTROLLER_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const LLAMMA_CRVUSD_AMM_wstETH_LONG = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, AMM_wstETH_LONG_ADDRESS);
    const PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG = await getPastEvents(LLAMMA_CRVUSD_AMM_wstETH_LONG, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG)) {
        for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_wstETH_LONG) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendAmmEvent(CONTROLLER_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    // ###################################################### CRV SHORT #######################################################
    const VAULT_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_CRV_SHORT_ADDRESS);
    const PAST_EVENTS_VAULT_CRV_SHORT = await getPastEvents(VAULT_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_VAULT_CRV_SHORT)) {
        for (const event of PAST_EVENTS_VAULT_CRV_SHORT) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendVaultEvent(VAULT_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
            console.log("\n\n new Event in VAULT_CRV_SHORT:", event);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const CONTROLLER_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLER_VAULT_CRV_SHORT_ADDRESS);
    const PAST_EVENTS_CONTROLLER_CRV_SHORT = await getPastEvents(CONTROLLER_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_CONTROLLER_CRV_SHORT)) {
        for (const event of PAST_EVENTS_CONTROLLER_CRV_SHORT) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            console.log("\n\n new Event in CONTROLLER_CRV_SHORT:", event);
            await processLlamalendControllerEvent(CONTROLLER_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    const LLAMMA_CRVUSD_AMM_CRV_SHORT = new Web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, AMM_CRV_SHORT_ADDRESS);
    const PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT = await getPastEvents(LLAMMA_CRVUSD_AMM_CRV_SHORT, "allEvents", START_BLOCK, END_BLOCK);
    if (Array.isArray(PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT)) {
        for (const event of PAST_EVENTS_LLAMMA_CRVUSD_AMM_CRV_SHORT) {
            // if ((event as EthereumEvent).transactionHash !== "0x3d71d787c1bbfd465b437688222309e461653298323d978f7a8219140aebbdba") continue;
            await processLlamalendAmmEvent(CONTROLLER_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS, event, eventEmitter);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    console.log("done");
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit();
}
async function liveMode(eventEmitter) {
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    await checkWsConnectionViaNewBlocks();
    // CRV LONG
    const VAULT_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_CRV_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_CRV_LONG, eventEmitter, "Vault", VAULT_CRV_LONG_ADDRESS);
    // CRV LONG
    const CONTROLLER_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLLER_CRV_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLLER_CRV_LONG, eventEmitter, "Controller", VAULT_CRV_LONG_ADDRESS);
    // CRV LONG
    const LLAMMA_CRVUSD_AMM_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_AMM, AMM_CRV_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_CRV_LONG, eventEmitter, "Amm", VAULT_CRV_LONG_ADDRESS);
    // wsETH LONG
    const VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_wstETH_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_wstETH_LONG, eventEmitter, "Vault", VAULT_wstETH_LONG_ADDRESS);
    // wsETH LONG
    const CONTROLLER_VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLLER_VAULT_wstETH_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLLER_VAULT_wstETH_LONG, eventEmitter, "Controller", VAULT_wstETH_LONG_ADDRESS);
    // wsETH LONG
    const LLAMMA_CRVUSD_AMM_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_AMM, AMM_wstETH_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_wstETH_LONG, eventEmitter, "Amm", VAULT_wstETH_LONG_ADDRESS);
    // CRV SHORT
    const VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_VAULT, VAULT_CRV_SHORT_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_CRV_SHORT, eventEmitter, "Vault", VAULT_CRV_SHORT_ADDRESS);
    // CRV SHORT
    const CONTROLER_VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_CONTROLLER, CONTROLER_VAULT_CRV_SHORT_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLER_VAULT_CRV_SHORT, eventEmitter, "Controller", VAULT_CRV_SHORT_ADDRESS);
    // CRV SHORT
    const LLAMMA_CRVUSD_AMM_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_LLAMALEND_AMM, AMM_CRV_SHORT_ADDRESS);
    subscribeToLendingMarketsEvents(LLAMMA_CRVUSD_AMM_CRV_SHORT, eventEmitter, "Amm", VAULT_CRV_SHORT_ADDRESS);
    eventEmitter.on("newLendingMarketsEvent", async ({ event, type, contract, llamaLendVaultAddress }) => {
        console.log("\n\n\n\nnew event in lending market:", llamaLendVaultAddress, ":", event, "type:", type, "contract", contract);
        if (type === "Vault") {
            await processLlamalendVaultEvent(contract, llamaLendVaultAddress, event, eventEmitter);
        }
        else if (type === "Controller") {
            await processLlamalendControllerEvent(contract, llamaLendVaultAddress, event, eventEmitter);
        }
        else if (type === "Amm") {
            await processLlamalendAmmEvent(contract, llamaLendVaultAddress, event, eventEmitter);
        }
    });
}
// Markets:
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
export async function launchCurveLendingMonitoring(eventEmitter) {
    // await histoMode(eventEmitter);
    await liveMode(eventEmitter);
}
//# sourceMappingURL=LlamalendMain.js.map