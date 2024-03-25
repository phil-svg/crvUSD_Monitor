import { getBorrowApr, getCollatDollarValue, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket } from "../helperFunctions/Lending.js";
import { web3HttpProvider, webWsProvider } from "../helperFunctions/Web3.js";
import { getPriceOf_crvUSD } from "../priceAPI/priceAPI.js";
import { buildLendingMarketBorrowMessage, buildLendingMarketDepositMessage, buildLendingMarketHardLiquidateMessage, buildLendingMarketRemoveCollateralMessage, buildLendingMarketRepayMessage, buildLendingMarketSelfLiquidateMessage, buildLendingMarketWithdrawMessage, buildSoftLiquidateMessage, } from "../telegram/TelegramBot.js";
import { checkWsConnectionViaNewBlocks, getCurrentBlockNumber, getPastEvents, getTxReceiptClassic, subscribeToLendingMarketsEvents } from "../web3Calls/generic.js";
import { ABI_LLAMALEND_AMM, ABI_LLAMALEND_CONTROLLER, ABI_LLAMALEND_FACTORY, ABI_LLAMALEND_VAULT } from "./Abis.js";
import { enrichMarketData, extractParsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation, handleEvent } from "./Helper.js";
async function processLlamalendVaultEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    const txHash = event.transactionHash;
    const isLongPosition = market.market_name.endsWith("Long");
    let crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    if (!crvUSDPrice)
        return;
    const otherTokenDollarValue = await getCollatDollarValue(market, ammContract, event.blockNumber);
    let borrowedTokenDollarPricePerUnit = 0;
    if (isLongPosition) {
        borrowedTokenDollarPricePerUnit = crvUSDPrice;
    }
    else {
        borrowedTokenDollarPricePerUnit = otherTokenDollarValue;
    }
    if (event.event === "Deposit") {
        const agentAddress = event.returnValues.sender;
        const parsedDepositedBorrowTokenAmount = event.returnValues.assets / 10 ** Number(market.borrowed_token_decimals);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const dollarAmount = parsedDepositedBorrowTokenAmount * borrowedTokenDollarPricePerUnit;
        const message = buildLendingMarketDepositMessage(market, txHash, dollarAmount, agentAddress, parsedDepositedBorrowTokenAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Withdraw") {
        const agentAddress = event.returnValues.sender;
        const parsedWithdrawnBorrowTokenAmount = event.returnValues.assets / 10 ** Number(market.borrowed_token_decimals);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const dollarAmount = parsedWithdrawnBorrowTokenAmount * borrowedTokenDollarPricePerUnit;
        const message = buildLendingMarketWithdrawMessage(market, txHash, dollarAmount, agentAddress, parsedWithdrawnBorrowTokenAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket);
        eventEmitter.emit("newMessage", message);
    }
}
async function processLlamalendControllerEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    if (!["Borrow", "Repay", "RemoveCollateral", "Liquidate"].includes(event.event))
        return;
    const isLongPosition = market.market_name.endsWith("Long");
    let crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
    if (!crvUSDPrice)
        return;
    const otherTokenDollarValue = await getCollatDollarValue(market, ammContract, event.blockNumber);
    let borrowedTokenDollarPricePerUnit = 0;
    let collatTokenDollarPricePerUnit = 0;
    if (isLongPosition) {
        collatTokenDollarPricePerUnit = otherTokenDollarValue;
        borrowedTokenDollarPricePerUnit = crvUSDPrice;
    }
    else {
        borrowedTokenDollarPricePerUnit = otherTokenDollarValue;
        collatTokenDollarPricePerUnit = crvUSDPrice;
    }
    const txHash = event.transactionHash;
    const agentAddress = event.returnValues.user;
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
    if (event.event === "Borrow") {
        const parsedBorrowedAmount = event.returnValues.loan_increase / 10 ** Number(market.borrowed_token_decimals);
        const parsedCollatAmount = event.returnValues.collateral_increase / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const dollarAmountBorrow = parsedBorrowedAmount * borrowedTokenDollarPricePerUnit;
        const message = buildLendingMarketBorrowMessage(market, txHash, agentAddress, parsedBorrowedAmount, parsedCollatAmount, positionHealth, totalDebtInMarket, collatDollarAmount, dollarAmountBorrow, borrowApr, lendApr, totalAssets);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "Repay") {
        const parsedRepayAmount = event.returnValues.loan_decrease / 10 ** Number(market.borrowed_token_decimals);
        const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const repayDollarAmount = parsedRepayAmount * borrowedTokenDollarPricePerUnit;
        const message = buildLendingMarketRepayMessage(market, txHash, positionHealth, totalDebtInMarket, agentAddress, parsedRepayAmount, collatDollarAmount, parsedCollatAmount, repayDollarAmount, borrowApr, lendApr, totalAssets);
        eventEmitter.emit("newMessage", message);
    }
    if (event.event === "RemoveCollateral") {
        const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const message = buildLendingMarketRemoveCollateralMessage(market, parsedCollatAmount, txHash, agentAddress, positionHealth, collatDollarAmount, totalDebtInMarket, borrowApr, lendApr, totalAssets);
        eventEmitter.emit("newMessage", message);
    }
    // HARD-LIQUIDATION
    if (event.event === "Liquidate") {
        const receipt = await getTxReceiptClassic(txHash);
        let parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation = extractParsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation(receipt, market);
        if (!parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation) {
            parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation = 0;
        }
        const borrowTokenDollarAmount = parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation * borrowedTokenDollarPricePerUnit;
        const liquidatorAddress = event.returnValues.liquidator;
        const poorFellaAddress = event.returnValues.user;
        const parsedCollatAmount = event.returnValues.collateral_received / 10 ** market.collateral_token_decimals;
        const collarDollarValue = parsedCollatAmount * collatTokenDollarPricePerUnit;
        if (poorFellaAddress.toLowerCase() === liquidatorAddress.toLowerCase()) {
            const message = buildLendingMarketSelfLiquidateMessage(market, parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation, borrowTokenDollarAmount, parsedCollatAmount, collarDollarValue, txHash, totalDebtInMarket, borrowApr, lendApr, totalAssets, liquidatorAddress);
            eventEmitter.emit("newMessage", message);
        }
        else {
            const message = buildLendingMarketHardLiquidateMessage(market, parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation, borrowTokenDollarAmount, parsedCollatAmount, collarDollarValue, txHash, totalDebtInMarket, borrowApr, lendApr, totalAssets, liquidatorAddress, poorFellaAddress);
            eventEmitter.emit("newMessage", message);
        }
    }
}
async function processLlamalendAmmEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    if (event.event === "TokenExchange") {
        console.log("Soft Liquidation spotted");
        console.log("\n\n new Event in LLAMMA_CRVUSD_AMM:", event);
        const isLongPosition = market.market_name.endsWith("Long");
        let crvUSDPrice = await getPriceOf_crvUSD(event.blockNumber);
        if (!crvUSDPrice)
            return;
        const otherTokenDollarValue = await getCollatDollarValue(market, ammContract, event.blockNumber);
        let borrowedTokenDollarPricePerUnit = 0;
        let collatTokenDollarPricePerUnit = 0;
        if (isLongPosition) {
            collatTokenDollarPricePerUnit = otherTokenDollarValue;
            borrowedTokenDollarPricePerUnit = crvUSDPrice;
        }
        else {
            borrowedTokenDollarPricePerUnit = otherTokenDollarValue;
            collatTokenDollarPricePerUnit = crvUSDPrice;
        }
        const txHash = event.transactionHash;
        const agentAddress = event.returnValues.buyer;
        let parsedSoftLiquidatedAmount;
        let parsedRepaidAmount;
        if (event.returnValues.sold_id === "0") {
            parsedSoftLiquidatedAmount = event.returnValues.tokens_bought / 10 ** market.borrowed_token_decimals;
            parsedRepaidAmount = event.returnValues.tokens_sold / 10 ** market.collateral_token_decimals;
        }
        else {
            parsedSoftLiquidatedAmount = event.returnValues.tokens_sold / 10 ** market.collateral_token_decimals;
            parsedRepaidAmount = event.returnValues.tokens_bought / 10 ** market.borrowed_token_decimals;
        }
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedSoftLiquidatedAmount;
        const repaidBorrrowTokenDollarAmount = parsedRepaidAmount * borrowedTokenDollarPricePerUnit;
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const message = buildSoftLiquidateMessage(market, txHash, agentAddress, parsedSoftLiquidatedAmount, collatDollarAmount, parsedRepaidAmount, repaidBorrrowTokenDollarAmount, borrowApr, lendApr, totalDebtInMarket, totalAssets);
        eventEmitter.emit("newMessage", message);
    }
}
async function getAllLendingMarkets() {
    // const LENDING_LAUNCH_BLOCK_V1 = 19290923; // v1
    const LENDING_LAUNCH_BLOCK = 19415827; // v2
    const PRESENT = await getCurrentBlockNumber();
    const llamalendFactory = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_FACTORY, llamalendFactoryAddress);
    const result = await getPastEvents(llamalendFactory, "NewVault", LENDING_LAUNCH_BLOCK, PRESENT);
    let events = [];
    if (Array.isArray(result)) {
        events = result;
    }
    else {
        return [];
    }
    const lendingMarkets = await Promise.all(events.map((event) => handleEvent(event)));
    lendingMarkets.sort((a, b) => a.id.localeCompare(b.id));
    return lendingMarkets;
}
async function histoMode(allLendingMarkets, eventEmitter) {
    // const LENDING_LAUNCH_BLOCK_V1 = 19290923; // v1
    const LENDING_LAUNCH_BLOCK = 19415827; // v2
    const PRESENT = await getCurrentBlockNumber();
    // const START_BLOCK = LENDING_LAUNCH_BLOCK;
    // const END_BLOCK = PRESENT;
    const START_BLOCK = 19509299;
    const END_BLOCK = 19509299;
    console.log("start");
    for (const market of allLendingMarkets) {
        // used to filter for only 1 market to speed up debugging, works for address of vault, controller, or amm
        // if (!filterForOnly("0x52096539ed1391CB50C6b9e4Fd18aFd2438ED23b", market)) continue;
        // console.log("\nmarket", market);
        const vaultContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, market.vault);
        const controllerContact = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, market.controller);
        const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);
        const pastEventsVault = await getPastEvents(vaultContract, "allEvents", START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsVault)) {
            for (const event of pastEventsVault) {
                await processLlamalendVaultEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
                console.log("\n\n new Event in Vault:", event);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        const pastEventsController = await getPastEvents(controllerContact, "allEvents", START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsController)) {
            for (const event of pastEventsController) {
                console.log("\n\n new Event in Controller:", event);
                await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        const pastEventsAmm = await getPastEvents(ammContract, "allEvents", START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsAmm)) {
            for (const event of pastEventsAmm) {
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
async function liveMode(allLendingMarkets, eventEmitter) {
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
    eventEmitter.on("newLendingMarketsEvent", async ({ market, event, type, vaultContract, controllerContact, ammContract }) => {
        console.log("\n\n\n\nnew event in Market:", market.vault, ":", event, "type:", type);
        if (type === "Vault") {
            await processLlamalendVaultEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
        else if (type === "Controller") {
            await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
        else if (type === "Amm") {
            await processLlamalendAmmEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
    });
}
// Markets: (v3)
const llamalendFactoryAddress = "0xeA6876DDE9e3467564acBeE1Ed5bac88783205E0"; // v3
// todo
export async function launchCurveLendingMonitoring(eventEmitter) {
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
/*
allEnrichedLendingMarkets [
  {
    id: '0',
    collateral_token: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0x8cf1DE26729cfB7137AF1A6B2a665e099EC319b5',
    controller: '0x1E0165DbD2019441aB7927C018701f3138114D71',
    amm: '0x847D7a5e4Aa4b380043B2908C29a92E2e5157E64',
    price_oracle: '0x5e2406D3D86F8c4a22baC9713F0A38804e9Ef181',
    monetary_policy: '0x112E37742015ECe4cEB4b576a9434940838eAf02',
    collateral_token_symbol: 'wstETH',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'wstETH Long'
  },
  {
    id: '1',
    collateral_token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0x5AE28c9197a4a6570216fC7e53E7e0221D7A0FEF',
    controller: '0xaade9230AA9161880E13a38C83400d3D1995267b',
    amm: '0xb46aDcd1eA7E35C4EB801406C3E76E76e9a46EdF',
    price_oracle: '0x6530B69479549BD3Cc806463964d58D69c285BD8',
    monetary_policy: '0xa6c73DC07E17Feda6925C2a4F44C166Fc18Fcf1F',
    collateral_token_symbol: 'WETH',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'WETH Long'
  },
  {
    id: '2',
    collateral_token: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0xb2b23C87a4B6d1b03Ba603F7C3EB9A81fDC0AAC9',
    controller: '0x413FD2511BAD510947a91f5c6c79EBD8138C29Fc',
    amm: '0x5338B1bf469651a5951ef618Fb5DeFbffaed7BE9',
    price_oracle: '0xeF42b6525454dAbA2d73441a5c749c82a942692B',
    monetary_policy: '0xde31c340545c8031843Bff5Eb42640009961aeEF',
    collateral_token_symbol: 'tBTC',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'tBTC Long'
  },
  {
    id: '3',
    collateral_token: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0xCeA18a8752bb7e7817F9AE7565328FE415C0f2cA',
    controller: '0xEdA215b7666936DEd834f76f3fBC6F323295110A',
    amm: '0xafca625321Df8D6A068bDD8F1585d489D2acF11b',
    price_oracle: '0xE0a4C53408f5ACf3246c83b9b8bD8d36D5ee38B8',
    monetary_policy: '0x8b6527063FbC9c30731D7E57F1DEf08edce57d07',
    collateral_token_symbol: 'CRV',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'CRV Long'
  },
  {
    id: '4',
    collateral_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    borrowed_token: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    vault: '0x4D2f44B0369f3C20c3d670D2C26b048985598450',
    controller: '0xC510d73Ad34BeDECa8978B6914461aA7b50CF3Fc',
    amm: '0xe7B1c8cfC0Bc45957320895aA06884d516DAA8e6',
    price_oracle: '0xD4Dc9D7567F76fAD2b5A90D3a1bdb3eE801435A8',
    monetary_policy: '0x40A442F8CBFd125a762b55F76D9Dba66F84Dd6DD',
    collateral_token_symbol: 'crvUSD',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'CRV',
    borrowed_token_decimals: 18,
    market_name: 'CRV Short'
  },
  {
    id: '5',
    collateral_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    borrowed_token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    vault: '0x46196C004de85c7a75C8b1bB9d54Afb0f8654A45',
    controller: '0xa5D9137d2A1Ee912469d911A8E74B6c77503bac8',
    amm: '0x08Ba6D7c10d1A7850aE938543bfbEA7C0240F9Cf',
    price_oracle: '0x4f4B897871902d05cBa110B8e892498f12a20443',
    monetary_policy: '0xbDb065458d34DB77d1fB2862D367edd8275f8352',
    collateral_token_symbol: 'crvUSD',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'WETH',
    borrowed_token_decimals: 18,
    market_name: 'WETH Short'
  },
  {
    id: '6',
    collateral_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    borrowed_token: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
    vault: '0x99Cff9Dc26A44dc2496B4448ebE415b5E894bd30',
    controller: '0xe438658874b0acf4D81c24172E137F0eE00621b8',
    amm: '0xfcb53ED72dAB68091aA6a2aB68b5116639ED8805',
    price_oracle: '0x33A95b2121fd4eC89D9fA6C5FD21545270bC06a6',
    monetary_policy: '0x62cD08caDABF473315D8953995DE0Dc0928b7D3C',
    collateral_token_symbol: 'crvUSD',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'tBTC',
    borrowed_token_decimals: 18,
    market_name: 'tBTC Short'
  },
  {
    id: '7',
    collateral_token: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0x52096539ed1391CB50C6b9e4Fd18aFd2438ED23b',
    controller: '0x98Fc283d6636f6DCFf5a817A00Ac69A3ADd96907',
    amm: '0x9bBdb1b160B48C48efCe260aaEa4505b1aDE8f4B',
    price_oracle: '0x50c39EA8f3D72310C8B56A56B333994266e9b477',
    monetary_policy: '0xF82A5a3c69cA11601C9aD4A351A75857bDd1365F',
    collateral_token_symbol: 'sUSDe',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'sUSDe Long'
  }
]
*/
//# sourceMappingURL=LlamalendMain.js.map