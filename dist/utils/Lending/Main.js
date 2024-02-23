import { getBorrowApr, getCollatDollarValue, getCollateralTokenAddress, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket } from "../helperFunctions/Lending.js";
import { getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { getCoinSymbol } from "../pegkeeper/Pegkeeper.js";
import { buildLendingMarketBorrowMessage, buildLendingMarketDepositMessage, buildLendingMarketLiquidateMessage, buildLendingMarketRemoveCollateralMessage, buildLendingMarketRepayMessage, buildLendingMarketWithdrawMessage, } from "../telegram/TelegramBot.js";
import { getCurrentBlockNumber, subscribeToLendingMarketsEvents } from "../web3Calls/generic.js";
import { ABI_CONTROLER_VAULT_CRV_SHORT, ABI_CONTROLLER_CRV_LONG, ABI_VAULT_CRV_LONG, ABI_VAULT_CRV_SHORT, ABI_VAULT_wstETH_LONG, CONTROLLER_ABI_VAULT_wstETH_LONG, } from "./Abis.js";
async function processSingleVaultEvent(lendingMarketContract, lendingMarketAddress, event, eventEmitter) {
    if (event.event === "Deposit") {
        const txHash = event.transactionHash;
        const AGENT = event.returnValues.sender;
        const PARSED_DEPOSIT_AMOUNT = event.returnValues.assets / 1e18;
        const BORROW_APR = await getBorrowApr(lendingMarketContract, event.blockNumber);
        const LEND_APR = await getLendApr(lendingMarketContract, event.blockNumber);
        const TOTAL_ASSETS = await getTotalAssets(lendingMarketContract, event.blockNumber);
        const message = buildLendingMarketDepositMessage(lendingMarketAddress, txHash, AGENT, PARSED_DEPOSIT_AMOUNT, BORROW_APR, LEND_APR, TOTAL_ASSETS);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Withdraw") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const txHash = event.transactionHash;
        const message = buildLendingMarketWithdrawMessage(txHash);
        eventEmitter.emit("newMessage", message);
    }
}
async function processSingleControllerEvent(controllerContract, lendingMarketAddress, event, eventEmitter) {
    if (event.event === "Borrow") {
        const txHash = event.transactionHash;
        const agentAddress = event.returnValues.user;
        const parsedBorrowedAmount = event.returnValues.loan_increase / 1e18;
        const parsedCollatAmount = event.returnValues.collateral_increase / 1e18;
        const collatAddress = await getCollateralTokenAddress(controllerContract);
        const WEB3_WS_PROVIDER = getWeb3WsProvider();
        const collatName = await getCoinSymbol(collatAddress, WEB3_WS_PROVIDER);
        const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
        const totalDebtInMarket = await getTotalDebtInMarket(controllerContract, event.blockNumber);
        const collatDollarValue = await getCollatDollarValue(controllerContract, event.blockNumber);
        const collatDollarAmount = collatDollarValue * parsedCollatAmount;
        const message = buildLendingMarketBorrowMessage(txHash, agentAddress, parsedBorrowedAmount, parsedCollatAmount, collatName, collatAddress, positionHealth, lendingMarketAddress, totalDebtInMarket, collatDollarAmount);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Repay") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const txHash = event.transactionHash;
        const message = buildLendingMarketRepayMessage(txHash);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "RemoveCollateral") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const txHash = event.transactionHash;
        const message = buildLendingMarketRemoveCollateralMessage(txHash);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Liquidate") {
        // todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo// todo
        const txHash = event.transactionHash;
        const message = buildLendingMarketLiquidateMessage(txHash);
        eventEmitter.emit("newMessage", message);
    }
}
export async function launchCurveLendingMonitoring(eventEmitter) {
    const LLAMMA_crvUSD_AMM_ADDRESS = "0x4f37395BdFbE3A0dca124ad3C9DbFe6A6cbc31D6";
    const crvUSD_CONTROLLER_ADDRESS = "0x5473B1BcBbC45d38d8fBb50a18a73aFb8B0637A7";
    const VAULT_ADDRESS = "0x596F8E49acE6fC8e09B561972360DC216f1c2A1f";
    const CryptoFromPool_ADDRESS = "0x9164e210d123e6566DaF113136a73684C4AB01e2";
    const SEMI_LOG_MONETARY_POLICY_ADDRESS = "0xa7E98815c0193E01165720C3abea43B885ae67FD";
    const LIQUIDITY_GAUGE_V6_ADDRESS = "0x00B71A425Db7C8B65a46CF39c23A188e10A2DE99";
    const ONE_WAY_LENDING_FACTORY_ADDRESS = "0xc67a44D958eeF0ff316C3a7c9E14FB96f6DedAA3";
    // VAULTS:
    const VAULT_wstETH_LONG_ADDRESS = "0xE21C518a09b26Bf65B16767B97249385f12780d9";
    const CONTROLLER_VAULT_wstETH_LONG_ADDRESS = "0x5E657c5227A596a860621C5551c9735d8f4A8BE3";
    const GAUGE_VAULT_wstETH_LONG_ADDRESS = "0x3742aCa9ad8655d2d3eab5569eF1BdB4C5d52e5D";
    const VAULT_CRV_LONG_ADDRESS = "0x67A18c18709C09D48000B321c6E1cb09F7181211"; // txHit Mich deposit
    const CONTROLLER_CRV_LONG_ADDRESS = "0x7443944962D04720f8c220C0D25f56F869d6EfD4"; // taking loans from controller
    const GAUGE_VAULT_CRV_LONG_ADDRESS = "0xAA90BE8bd52aeA49314dFc6e385e21A4e9c4ea0c";
    const VAULT_CRV_SHORT_ADDRESS = "0x044aC5160e5A04E09EBAE06D786fc151F2BA5ceD";
    const CONTROLER_VAULT_CRV_SHORT_ADDRESS = "0x43fc0f246F952ff12B757341A91cF4040711dDE9";
    const GAUGE_VAULT_CRV_SHORT_ADDRESS = "0x270100d0D9D26E16F458cC4F71224490Ebc8F234";
    //
    const LENDING_LAUNCH_BLOCK = 19290923;
    const PRESENT = await getCurrentBlockNumber();
    const WEB3_WS_PROVIDER = getWeb3WsProvider();
    // HISTO-MODE
    // const VAULT_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS);
    // const PAST_EVENTS_VAULT_CRV_LONG = await getPastEvents(VAULT_CRV_LONG, "allEvents", LENDING_LAUNCH_BLOCK, PRESENT);
    // if (Array.isArray(PAST_EVENTS_VAULT_CRV_LONG)) {
    //   PAST_EVENTS_VAULT_CRV_LONG.forEach(async (event) => {
    //     await processSingleVaultEvent(VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
    //   });
    // }
    // const CONTROLLER_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER_CRV_LONG, CONTROLLER_CRV_LONG_ADDRESS);
    // const PAST_EVENTS_CONTROLLER_CRV_LONG = await getPastEvents(CONTROLLER_CRV_LONG, "allEvents", LENDING_LAUNCH_BLOCK, PRESENT);
    // if (Array.isArray(PAST_EVENTS_CONTROLLER_CRV_LONG)) {
    //   PAST_EVENTS_CONTROLLER_CRV_LONG.forEach(async (event) => {
    //     await processSingleControllerEvent(CONTROLLER_CRV_LONG, CONTROLLER_CRV_LONG_ADDRESS, VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS, event, eventEmitter);
    //   });
    // }
    // LIVE-MODE
    const VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_wstETH_LONG, VAULT_wstETH_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_wstETH_LONG, eventEmitter, "Vault", VAULT_wstETH_LONG_ADDRESS);
    const CONTROLLER_VAULT_wstETH_LONG = new WEB3_WS_PROVIDER.eth.Contract(CONTROLLER_ABI_VAULT_wstETH_LONG, CONTROLLER_VAULT_wstETH_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLLER_VAULT_wstETH_LONG, eventEmitter, "Controller", VAULT_wstETH_LONG_ADDRESS);
    const VAULT_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_CRV_LONG, VAULT_CRV_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_CRV_LONG, eventEmitter, "Vault", VAULT_CRV_LONG_ADDRESS);
    const CONTROLLER_CRV_LONG = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLLER_CRV_LONG, CONTROLLER_CRV_LONG_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLLER_CRV_LONG, eventEmitter, "Controller", VAULT_CRV_LONG_ADDRESS);
    const VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_VAULT_CRV_SHORT, VAULT_CRV_SHORT_ADDRESS);
    subscribeToLendingMarketsEvents(VAULT_CRV_SHORT, eventEmitter, "Vault", VAULT_CRV_SHORT_ADDRESS);
    const CONTROLER_VAULT_CRV_SHORT = new WEB3_WS_PROVIDER.eth.Contract(ABI_CONTROLER_VAULT_CRV_SHORT, CONTROLER_VAULT_CRV_SHORT_ADDRESS);
    subscribeToLendingMarketsEvents(CONTROLER_VAULT_CRV_SHORT, eventEmitter, "Controller", VAULT_CRV_SHORT_ADDRESS);
    eventEmitter.on("newLendingMarketsEvent", async ({ event: event, type: type, contract: contract, lendingMarketAddress: lendingMarketAddress }) => {
        console.log("new event in lending markets:", event, ".. with lendingMarketAddress:", lendingMarketAddress);
        if (type === "Vault") {
            await processSingleVaultEvent(contract, lendingMarketAddress, event, eventEmitter);
        }
        if (type === "Controller") {
            await processSingleControllerEvent(contract, lendingMarketAddress, event, eventEmitter);
        }
    });
}
//# sourceMappingURL=Main.js.map