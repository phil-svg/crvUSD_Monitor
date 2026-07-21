import { getBorrowApr, getCollatDollarValue, getLendApr, getPositionHealth, getTotalAssets, getTotalDebtInMarket, } from '../helperFunctions/Lending.js';
import { getPriceOf_crvUSD } from '../priceAPI/priceAPI.js';
import { buildLendingMarketBorrowMessage, buildLendingMarketDepositMessage, buildLendingMarketHardLiquidateMessage, buildLendingMarketRemoveCollateralMessage, buildLendingMarketRepayMessage, buildLendingMarketSelfLiquidateMessage, buildLendingMarketWithdrawMessage, buildSoftLiquidateMessage, } from '../telegram/TelegramBot.js';
import { ABI_LLAMALEND_AMM, ABI_LLAMALEND_CONTROLLER, ABI_LLAMALEND_VAULT } from './Abis.js';
import { enrichMarketData, getFirstGaugeCrvApyByVaultAddress, } from './Helper.js';
import eventEmitter from '../EventEmitter.js';
import { saveLastSeenToFile } from '../Oragnizer.js';
import { getPastEvents, web3HttpProvider } from '../web3/Web3Basics.js';
import { fetchEventsRealTime, registerHandler } from '../web3/AllEvents.js';
import { LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING_V2, LENDING_MIN_LIQUIDATION_DISCOUNT_WORTH_PRINTING_V2, LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2, } from '../Constants.js';
import { getAllLendingMarkets } from './AllLendingMarkets.js';
async function processLlamalendVaultEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    const txHash = event.transactionHash;
    const isLongPosition = market.market_name.endsWith('Long');
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
    if (event.event === 'Deposit') {
        const agentAddress = event.returnValues.sender;
        const parsedDepositedBorrowTokenAmount = event.returnValues.assets / 10 ** Number(market.borrowed_token_decimals);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const dollarAmount = parsedDepositedBorrowTokenAmount * borrowedTokenDollarPricePerUnit;
        if (dollarAmount < LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2)
            return;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const message = buildLendingMarketDepositMessage(market, txHash, dollarAmount, agentAddress, parsedDepositedBorrowTokenAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket, gaugeBoostPercentage, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
    if (event.event === 'Withdraw') {
        const agentAddress = event.returnValues.sender;
        const parsedWithdrawnBorrowTokenAmount = event.returnValues.assets / 10 ** Number(market.borrowed_token_decimals);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const dollarAmount = parsedWithdrawnBorrowTokenAmount * borrowedTokenDollarPricePerUnit;
        if (dollarAmount < LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2)
            return;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const message = buildLendingMarketWithdrawMessage(market, txHash, dollarAmount, agentAddress, parsedWithdrawnBorrowTokenAmount, borrowApr, lendApr, totalAssets, totalDebtInMarket, gaugeBoostPercentage, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
}
async function processLlamalendControllerEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    if (!['Borrow', 'Repay', 'RemoveCollateral', 'Liquidate'].includes(event.event))
        return;
    const isLongPosition = market.market_name.endsWith('Long');
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
    const callerAddress = event.returnValues.caller; // NEW LINE FOR LL2
    const positionHealth = await getPositionHealth(controllerContract, agentAddress, event.blockNumber);
    const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
    const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
    const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
    const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
    if (event.event === 'Borrow') {
        const parsedBorrowedAmount = event.returnValues.loan_increase / 10 ** Number(market.borrowed_token_decimals);
        const parsedCollatAmount = event.returnValues.collateral_increase / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const dollarAmountBorrow = parsedBorrowedAmount * borrowedTokenDollarPricePerUnit;
        if (dollarAmountBorrow < LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2)
            return;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const message = buildLendingMarketBorrowMessage(market, txHash, agentAddress, parsedBorrowedAmount, parsedCollatAmount, positionHealth, totalDebtInMarket, collatDollarAmount, dollarAmountBorrow, borrowApr, lendApr, totalAssets, gaugeBoostPercentage, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
    if (event.event === 'Repay') {
        const parsedRepayAmount = event.returnValues.loan_decrease / 10 ** Number(market.borrowed_token_decimals);
        const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const repayDollarAmount = parsedRepayAmount * borrowedTokenDollarPricePerUnit;
        if (repayDollarAmount < LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2)
            return;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const message = buildLendingMarketRepayMessage(market, txHash, positionHealth, totalDebtInMarket, agentAddress, parsedRepayAmount, collatDollarAmount, parsedCollatAmount, repayDollarAmount, borrowApr, lendApr, totalAssets, gaugeBoostPercentage, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
    if (event.event === 'RemoveCollateral') {
        const parsedCollatAmount = event.returnValues.collateral_decrease / 10 ** Number(market.collateral_token_decimals);
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedCollatAmount;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        if (collatDollarAmount < LENDING_MIN_LOAN_CHANGE_AMOUNT_WORTH_PRINTING_V2)
            return;
        const message = buildLendingMarketRemoveCollateralMessage(market, parsedCollatAmount, txHash, agentAddress, positionHealth, collatDollarAmount, totalDebtInMarket, borrowApr, lendApr, totalAssets, gaugeBoostPercentage, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
    // HARD-LIQUIDATION
    if (event.event === 'Liquidate') {
        const parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation = Number(event.returnValues.borrowed_received) / 10 ** Number(market.borrowed_token_decimals);
        const borrowTokenDollarAmount = parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation * borrowedTokenDollarPricePerUnit;
        const liquidatorAddress = event.returnValues.liquidator;
        const poorFellaAddress = event.returnValues.user;
        const parsedCollatAmount = event.returnValues.collateral_received / 10 ** market.collateral_token_decimals;
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const collarDollarValue = parsedCollatAmount * collatTokenDollarPricePerUnit;
        if (collarDollarValue < LENDING_MIN_HARDLIQ_AMOUNT_WORTH_PRINTING_V2)
            return;
        if (poorFellaAddress.toLowerCase() === liquidatorAddress.toLowerCase()) {
            const message = buildLendingMarketSelfLiquidateMessage(market, parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation, borrowTokenDollarAmount, parsedCollatAmount, collarDollarValue, txHash, totalDebtInMarket, borrowApr, lendApr, totalAssets, liquidatorAddress, gaugeBoostPercentage, 'is LLamaLend V2');
            eventEmitter.emit('newMessage', message);
        }
        else {
            const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
            const message = buildLendingMarketHardLiquidateMessage(market, parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation, borrowTokenDollarAmount, parsedCollatAmount, collarDollarValue, txHash, totalDebtInMarket, borrowApr, lendApr, totalAssets, liquidatorAddress, poorFellaAddress, gaugeBoostPercentage, 'is LLamaLend V2');
            eventEmitter.emit('newMessage', message);
        }
    }
}
async function processLlamalendAmmEvent(market, llamalendVaultContract, controllerContract, ammContract, event, eventEmitter) {
    if (event.event === 'TokenExchange') {
        // console.log('Soft Liquidation spotted');
        // console.log('\n\n new Event in LLAMMA_CRVUSD_AMM:', event);
        const isLongPosition = market.market_name.endsWith('Long');
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
        if (event.returnValues.sold_id === '0') {
            parsedSoftLiquidatedAmount = event.returnValues.tokens_bought / 10 ** market.collateral_token_decimals;
            parsedRepaidAmount = event.returnValues.tokens_sold / 10 ** market.borrowed_token_decimals;
        }
        else {
            parsedSoftLiquidatedAmount = event.returnValues.tokens_sold / 10 ** market.collateral_token_decimals;
            parsedRepaidAmount = event.returnValues.tokens_bought / 10 ** market.borrowed_token_decimals;
        }
        const collatDollarAmount = collatTokenDollarPricePerUnit * parsedSoftLiquidatedAmount;
        const repaidBorrowTokenDollarAmount = parsedRepaidAmount * borrowedTokenDollarPricePerUnit;
        const totalDebtInMarket = await getTotalDebtInMarket(market, controllerContract, event.blockNumber);
        const borrowApr = await getBorrowApr(llamalendVaultContract, event.blockNumber);
        const lendApr = await getLendApr(llamalendVaultContract, event.blockNumber);
        const totalAssets = await getTotalAssets(market, llamalendVaultContract, event.blockNumber);
        const gaugeBoostPercentage = await getFirstGaugeCrvApyByVaultAddress(market.vault);
        const discountAmount = repaidBorrowTokenDollarAmount * market.fee;
        if (discountAmount < LENDING_MIN_LIQUIDATION_DISCOUNT_WORTH_PRINTING_V2)
            return;
        const message = buildSoftLiquidateMessage(market, txHash, agentAddress, parsedSoftLiquidatedAmount, collatDollarAmount, parsedRepaidAmount, repaidBorrowTokenDollarAmount, borrowApr, lendApr, totalDebtInMarket, totalAssets, gaugeBoostPercentage, discountAmount, 'is LLamaLend V2');
        eventEmitter.emit('newMessage', message);
    }
}
async function histoMode(allLendingMarkets, eventEmitter) {
    // const LENDING_LAUNCH_BLOCK_V1 = 19290923; // v1
    // const LENDING_LAUNCH_BLOCK = 19415827; // v1.1
    const LENDING_LAUNCH_BLOCK = 25523555; // v2
    const currentBlockNumber = await web3HttpProvider.eth.getBlockNumber();
    // const START_BLOCK = LENDING_LAUNCH_BLOCK;
    // const END_BLOCK = currentBlockNumber;
    const START_BLOCK = 25580679;
    const END_BLOCK = START_BLOCK;
    for (const market of allLendingMarkets) {
        // used to filter for only 1 market to speed up debugging, works for address of vault, controller, or amm
        // if (!filterForOnly("0x52096539ed1391CB50C6b9e4Fd18aFd2438ED23b", market)) continue;
        // console.log('\nmarket', market);
        const vaultContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, market.vault);
        const controllerContact = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, market.controller);
        const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);
        const pastEventsVault = await getPastEvents(vaultContract, 'allEvents', START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsVault)) {
            for (const event of pastEventsVault) {
                await processLlamalendVaultEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
                console.log('\n\n new Event in Vault:', event);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        const pastEventsController = await getPastEvents(controllerContact, 'allEvents', START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsController)) {
            for (const event of pastEventsController) {
                console.log('\n\n new Event in Controller:', event);
                await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        const pastEventsAmm = await getPastEvents(ammContract, 'allEvents', START_BLOCK, END_BLOCK);
        if (Array.isArray(pastEventsAmm)) {
            for (const event of pastEventsAmm) {
                console.log('\n\n new Event in Amm:', event);
                await processLlamalendAmmEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
    }
    console.log('done');
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit();
}
export async function subscribeToLendingMarketsEvents(market, vaultContract, vaultAddress, vaultABI, controllerContact, controllerAddress, controllerABI, ammContract, ammAddress, ammABI, eventEmitter, type) {
    let contract;
    let address;
    let abi;
    if (type === 'Vault') {
        contract = vaultContract;
        address = vaultAddress;
        abi = vaultABI;
    }
    else if (type === 'Controller') {
        contract = controllerContact;
        address = controllerAddress;
        abi = controllerABI;
    }
    else {
        contract = ammContract;
        address = ammAddress;
        abi = ammABI;
    }
    try {
        registerHandler(async (logs) => {
            const events = await fetchEventsRealTime(logs, address, abi, 'AllEvents');
            if (events.length > 0) {
                events.forEach((event) => {
                    console.log('LLAMMA LEND Event', event.transactionHash);
                    eventEmitter.emit('newLendingMarketsEvent', {
                        market,
                        event,
                        type,
                        vaultContract,
                        controllerContact,
                        ammContract,
                    });
                });
            }
        });
    }
    catch (err) {
        console.log('Error in fetching events:', err);
    }
}
async function liveMode(allLendingMarkets) {
    for (const market of allLendingMarkets) {
        // console.log('\nmarket', market);
        const vaultContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_VAULT, market.vault);
        const controllerContact = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_CONTROLLER, market.controller);
        const ammContract = new web3HttpProvider.eth.Contract(ABI_LLAMALEND_AMM, market.amm);
        subscribeToLendingMarketsEvents(market, vaultContract, market.vault, ABI_LLAMALEND_VAULT, controllerContact, market.controller, ABI_LLAMALEND_CONTROLLER, ammContract, market.amm, ABI_LLAMALEND_AMM, eventEmitter, 'Vault');
        subscribeToLendingMarketsEvents(market, vaultContract, market.vault, ABI_LLAMALEND_VAULT, controllerContact, market.controller, ABI_LLAMALEND_CONTROLLER, ammContract, market.amm, ABI_LLAMALEND_AMM, eventEmitter, 'Controller');
        subscribeToLendingMarketsEvents(market, vaultContract, market.vault, ABI_LLAMALEND_VAULT, controllerContact, market.controller, ABI_LLAMALEND_CONTROLLER, ammContract, market.amm, ABI_LLAMALEND_AMM, eventEmitter, 'Amm');
    }
    eventEmitter.on('newLendingMarketsEvent', async ({ market, event, type, vaultContract, controllerContact, ammContract }) => {
        // console.log('\n\n\n\nnew event in Market:', market.vault, ':', event, 'type:', type);
        console.log(`${event.transactionHash} | ${event.event} | lending`);
        await saveLastSeenToFile(event.transactionHash, new Date());
        if (type === 'Vault') {
            await processLlamalendVaultEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
        else if (type === 'Controller') {
            await processLlamalendControllerEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
        else if (type === 'Amm') {
            await processLlamalendAmmEvent(market, vaultContract, controllerContact, ammContract, event, eventEmitter);
        }
    });
}
export async function launchCurveLendingMonitoring_V2() {
    const allLendingMarkets = await getAllLendingMarkets();
    const allEnrichedLendingMarkets = await enrichMarketData(allLendingMarkets);
    if (!allEnrichedLendingMarkets) {
        console.log('Failed to boot LLamma Lend Markets, stopping!');
        return;
    }
    // console.log('allEnrichedLendingMarkets', allEnrichedLendingMarkets);
    // process.exit();
    // await histoMode(allEnrichedLendingMarkets, eventEmitter);
    console.log('allEnrichedLendingMarkets', allEnrichedLendingMarkets);
    await liveMode(allEnrichedLendingMarkets);
}
/*

allEnrichedLendingMarkets [
  {
    id: '0',
    collateral_token: '0xb45ad160634c528Cc3D2926d9807104FA3157305',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0x2b5a321C3cb1F33e1ABECD047C2649D0b4C47eBa',
    controller: '0xC77d97cF01737EB7aCE46cAb7cd9F60eC51a40c0',
    amm: '0xbf6f64B741164c26023f97fAaEA8e02453c27442',
    price_oracle: '0x0117ba42D18EaC940b469F81eD0a135ca23A1003',
    monetary_policy: '0xaA0c0290aa141280AA54702C21bA36d638d4dD07',
    collateral_token_symbol: 'sDOLA',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'sDOLA Long',
    fee: 0.002
  },
  {
    id: '1',
    collateral_token: '0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6',
    borrowed_token: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    vault: '0x3Da0F110079012387F47C6Fc6e878F10262E300a',
    controller: '0x3cD4d86a2c65e57ce4b4121b67E2D2224BA41bbe',
    amm: '0x63791be4985992580F84daE105bcc0e15C282d1F',
    price_oracle: '0xEa1b981203dBCcaeB1f2F00081A426B6308C8c2b',
    monetary_policy: '0x8E7a5fCfE2394E07556387EC9870C9f524AD50AF',
    collateral_token_symbol: 'sfrxUSD',
    collateral_token_decimals: 18,
    borrowed_token_symbol: 'crvUSD',
    borrowed_token_decimals: 18,
    market_name: 'sfrxUSD Long',
    fee: 0.002
  }
]

*/
//# sourceMappingURL=LlamalendMain.js.map