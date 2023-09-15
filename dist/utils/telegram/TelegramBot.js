import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { labels } from "../../Labels.js";
import { get1InchV5MinAmountInfo, getSwap1InchMinAmountInfo } from "../helperFunctions/1Inch.js";
import { MIN_HARDLIQ_AMOUNT_WORTH_PRINTING, MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING, MIN_REPAYED_AMOUNT_WORTH_PRINTING } from "../../crvUSD_Bot.js";
import { readFileAsync } from "../Oragnizer.js";
dotenv.config({ path: "../.env" });
function getTokenURL(tokenAddress) {
    return "https://etherscan.io/token/" + tokenAddress;
}
function getPoolURL(poolAddress) {
    return "https://etherscan.io/address/" + poolAddress;
}
function getTxHashURLfromEtherscan(txHash) {
    return "https://etherscan.io/tx/" + txHash;
}
function getTxHashURLfromEigenPhi(txHash) {
    return "https://eigenphi.io/mev/eigentx/" + txHash;
}
function getBuyerURL(buyerAddress) {
    return "https://etherscan.io/address/" + buyerAddress;
}
function getProfitPrint(profit, revenue, cost) {
    // if (Number(revenue) < Number(cost)) {
    //   return `Profit: ? | Revenue: ? | Cost: $${formatForPrint(cost)}`;
    // }
    if (profit > revenue * 0.5)
        return `Revenue: ¯⧵_(ツ)_/¯`;
    return `Profit: $${formatForPrint(profit)} | Revenue: $${formatForPrint(revenue)} | Cost: $${formatForPrint(cost)}`;
}
function getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount) {
    collatValue = formatForPrint(collatValue);
    marketBorrowedAmount = formatForPrint(marketBorrowedAmount);
    qtyCollat = formatForPrint(qtyCollat);
    return `Collateral: ${getShortenNumber(qtyCollat)} ${collateralName}${getDollarAddOn(collatValue)} | Borrowed: ${getShortenNumber(marketBorrowedAmount)} crvUSD`;
}
function formatForPrint(someNumber) {
    if (typeof someNumber === "string" && someNumber.includes(","))
        return someNumber;
    //someNumber = Math.abs(someNumber);
    if (someNumber > 100) {
        someNumber = Number(Number(someNumber).toFixed(0)).toLocaleString();
    }
    else if (someNumber > 5) {
        someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
    }
    else {
        someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
    }
    return someNumber;
}
function getShortenNumber(amountStr) {
    let amount = parseFloat(amountStr.replace(/,/g, ""));
    //amount = roundToNearest(amount);
    if (amount >= 1000000) {
        const millionAmount = amount / 1000000;
        if (Number.isInteger(millionAmount)) {
            return `${millionAmount.toFixed(0)}M`;
        }
        else {
            return `${millionAmount.toFixed(2)}M`;
        }
    }
    else if (amount >= 1000) {
        const thousandAmount = amount / 1000;
        if (Number.isInteger(thousandAmount)) {
            return `${thousandAmount.toFixed(0)}k`;
        }
        else {
            return `${thousandAmount.toFixed(1)}k`;
        }
    }
    else {
        return `${amount.toFixed(2)}`;
    }
}
function getDollarAddOn(amountStr) {
    let amount = parseFloat(amountStr.replace(/,/g, ""));
    //amount = roundToNearest(amount);
    if (amount >= 1000000) {
        const millionAmount = amount / 1000000;
        if (Number.isInteger(millionAmount)) {
            return ` ($${millionAmount.toFixed(0)}M)`;
        }
        else {
            return ` ($${millionAmount.toFixed(2)}M)`;
        }
    }
    else if (amount >= 1000) {
        const thousandAmount = amount / 1000;
        if (Number.isInteger(thousandAmount)) {
            return ` ($${thousandAmount.toFixed(0)}k)`;
        }
        else {
            return ` ($${thousandAmount.toFixed(1)}k)`;
        }
    }
    else {
        return ` ($${amount.toFixed(2)})`;
    }
}
function hyperlink(link, name) {
    return "<a href='" + link + "/'> " + name + "</a>";
}
let sentMessages = {};
export function send(bot, message, groupID) {
    const key = `${groupID}:${message}`;
    if (sentMessages[key]) {
        // console.log("This message has already been sent to this group in the past 30 seconds.");
        return;
    }
    bot.sendMessage(groupID, message, { parse_mode: "HTML", disable_web_page_preview: "true" });
    if (!message.startsWith("last seen")) {
        // Track the message as sent
        sentMessages[key] = true;
        // Delete the message from tracking after 30 seconds
        setTimeout(() => {
            delete sentMessages[key];
        }, 30000); // 30000 ms = 30 seconds
    }
}
function shortenAddress(address) {
    return address.slice(0, 5) + ".." + address.slice(-2);
}
function getAddressName(address) {
    // Find label for address
    const labelObject = labels.find((label) => label.Address.toLowerCase() === address.toLowerCase());
    // If label found, return it. Otherwise, return shortened address
    return labelObject ? labelObject.Label : shortenAddress(address);
}
export async function buildLiquidateMessage(formattedEventData, controllerAddress, ammAddress) {
    let { crvUSD_price, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, dollarAmount, liquidator, crvUSD_amount, user, stablecoin_received, collateral_received, txHash, crvUSDinCirculation, borrowRate, } = formattedEventData;
    console.log("stablecoin_received", stablecoin_received);
    if (stablecoin_received < MIN_HARDLIQ_AMOUNT_WORTH_PRINTING)
        return "don't print tiny hard-liquidations";
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const liquidatorURL = getBuyerURL(liquidator);
    const shortenLiquidator = getAddressName(liquidator);
    const userURL = getBuyerURL(user);
    const shortenUser = getAddressName(user);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    const AMM_URL = getPoolURL(controllerAddress);
    const CONTROLLER_URL = getPoolURL(ammAddress);
    dollarAmount = formatForPrint(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let liquidated = `hard-liquidated ${hyperlink(userURL, shortenUser)}`;
    if (liquidator === user)
        liquidated = `self-liquidated`;
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(liquidatorURL, shortenLiquidator)} ${liquidated} with ${formatForPrint(crvUSD_amount)}${hyperlink(crvUSD_URL, "crvUSD")} and ${formatForPrint(collateral_received)}${hyperlink(COLLATERAL_URL, collateralName)}
The${hyperlink(AMM_URL, "AMM")} send ${formatForPrint(stablecoin_received)}${hyperlink(crvUSD_URL, "crvUSD")} to the${hyperlink(CONTROLLER_URL, "Controller")}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildRemoveCollateralMessage(formattedEventData) {
    let { crvUSD_price, borrowerHealth, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, dollarAmount, collateral_decrease, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    if (dollarAmount < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
        return "don't print small amounts";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = getAddressName(buyer);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    if (borrowerHealth !== "no loan")
        borrowerHealth = formatForPrint(borrowerHealth * 100);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddon}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildRepayMessage(formattedEventData) {
    let { crvUSD_price, borrowerHealth, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_decrease, loan_decrease, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = getAddressName(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat = `repayed ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    if (collateral_decrease > 0 && loan_decrease > 1) {
        didWhat += ` and received ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    if (borrowerHealth !== "no loan")
        borrowerHealth = formatForPrint(borrowerHealth * 100);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}
export async function buildBorrowMessage(formattedEventData) {
    let { crvUSD_price, borrowerHealth, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_increase, collateral_increase_value, loan_increase, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = getAddressName(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    const dollarAddonCollat = getDollarAddOn(collateral_increase_value.toFixed(0));
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat;
    if (collateral_increase > 0 && loan_increase > 1) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddonCollat} and borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (collateral_increase > 0) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddonCollat}`;
    }
    else if (loan_increase >= 0) {
        if (loan_increase < MIN_REPAYED_AMOUNT_WORTH_PRINTING)
            return "don't print tiny liquidations";
        didWhat = `borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    if (borrowerHealth !== "no loan")
        borrowerHealth = formatForPrint(borrowerHealth * 100);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}
export async function buildDepositMessage(formattedEventData) {
    let { crvUSD_price, borrowerHealth, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, borrowedAmount, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = getAddressName(buyer);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    borrowedAmount = formatForPrint(borrowedAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    if (borrowerHealth !== "no loan")
        borrowerHealth = formatForPrint(borrowerHealth * 100);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} deposited ${borrowedAmount}${hyperlink(COLLATERAL_URL, collateralName)}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
async function buildSwapRouterMessage(formattedEventData) {
    let { crvUSD_price, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralName, numberOfcrvUSDper1_collat, collateral_price, soldAddress, boughtAddress, txHash, buyer, soldAmount, boughtAmount, dollarAmount, tokenSoldName, tokenBoughtName, crvUSDinCirculation, borrowRate, } = formattedEventData;
    let tokenInURL = getTokenURL(soldAddress);
    let tokenOutURL = getTokenURL(boughtAddress);
    let buyerURL = getBuyerURL(buyer);
    const shortenBuyer = "Swap Router";
    soldAmount = formatForPrint(soldAmount);
    boughtAmount = formatForPrint(boughtAmount);
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    let swappedWhat;
    if (tokenSoldName === "crvUSD") {
        swappedWhat = `traded ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)} for ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)}${dollarAddon}`;
    }
    else if (tokenSoldName === collateralName) {
        swappedWhat = `traded ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)}${dollarAddon} for ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
1 ${collateralName} ➛ ${formatForPrint(collateral_price)} Dollar | ${formatForPrint(numberOfcrvUSDper1_collat)} crvUSD
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildTokenExchangeMessage(formattedEventData) {
    let { crvUSD_price, marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralName, numberOfcrvUSDper1_collat, collateral_price, soldAddress, boughtAddress, txHash, buyer, soldAmount, boughtAmount, dollarAmount, tokenSoldName, tokenBoughtName, crvUSDinCirculation, profit, revenue, cost, researchPositionHealth, borrowRate, } = formattedEventData;
    const SWAP_ROUTER = "0x99a58482BD75cbab83b27EC03CA68fF489b5788f";
    if (buyer.toLowerCase() === SWAP_ROUTER.toLowerCase())
        return await buildSwapRouterMessage(formattedEventData);
    let tokenInURL = getTokenURL(soldAddress);
    let tokenOutURL = getTokenURL(boughtAddress);
    let buyerURL = getBuyerURL(buyer);
    const shortenBuyer = getAddressName(buyer);
    if (boughtAmount < MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING)
        return "don't print tiny liquidations";
    soldAmount = formatForPrint(soldAmount);
    boughtAmount = formatForPrint(boughtAmount);
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    let swappedWhat;
    if (tokenSoldName === "crvUSD") {
        swappedWhat = `liquidated ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)} with ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)}${dollarAddon}`;
    }
    else if (tokenSoldName === collateralName) {
        swappedWhat = `de-liquidated ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)} with ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)}${dollarAddon}`;
    }
    let profitPrint = getProfitPrint(profit, revenue, cost);
    if (shortenBuyer === "1Inch") {
        let _1Inchdetails = await getSwap1InchMinAmountInfo(txHash);
        profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${_1Inchdetails.tokenInName} to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${_1Inchdetails.tokenOutName}`;
    }
    else if (shortenBuyer === "1inch v5: Aggregation Router") {
        let _1Inchdetails = await get1InchV5MinAmountInfo(txHash);
        profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${_1Inchdetails.tokenInName} to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${_1Inchdetails.tokenOutName}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    let researchPositionHealthPrint = `${formatForPrint(researchPositionHealth * 100)} 🔭`;
    if (!researchPositionHealth)
        researchPositionHealthPrint = `— 🔭`;
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
${profitPrint}
Research Pos. Health: ${researchPositionHealthPrint}
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
async function getLastSeenValues() {
    try {
        const data = JSON.parse(await readFileAsync("lastSeen.json", "utf-8"));
        return {
            txHash: data.txHash,
            txTimestamp: new Date(data.txTimestamp),
        };
    }
    catch (error) {
        console.error("Error reading last seen data from file:", error);
        return null;
    }
}
function getTimeMessage(timestamp) {
    if (!timestamp)
        return "never seen"; // If no transaction was seen
    const differenceInSeconds = (new Date().getTime() - timestamp.getTime()) / 1000;
    if (differenceInSeconds < 60) {
        const seconds = Math.floor(differenceInSeconds);
        return `${seconds} ${seconds === 1 ? "second" : "seconds"} ago`;
    }
    if (differenceInSeconds < 3600) {
        const minutes = Math.floor(differenceInSeconds / 60);
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    }
    const hours = Math.floor(differenceInSeconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}
function getLastSeenMessage(txHash, timestamp) {
    const timeMessage = getTimeMessage(timestamp);
    const message = `The last seen crvUSD${hyperlink(getTxHashURLfromEtherscan(txHash), "tx")} was ${timeMessage}`;
    return message;
}
export async function telegramBotMain(env, eventEmitter) {
    eventEmitter.on("newMessage", (message) => {
        if (groupID) {
            send(bot, message, parseInt(groupID));
        }
    });
    let telegramGroupToken;
    let groupID;
    if (env == "prod") {
        telegramGroupToken = process.env.TELEGRAM_CRVUSD_PROD_KEY;
        groupID = process.env.TELEGRAM_PROD_GROUP_ID;
    }
    if (env == "test") {
        telegramGroupToken = process.env.TELEGRAM_CRVUSD_TEST_KEY;
        groupID = process.env.TELEGRAM_TEST_GROUP_ID;
    }
    const bot = new TelegramBot(telegramGroupToken, { polling: true });
    bot.on("message", async (msg) => {
        if (msg.text === "bot u with us") {
            await new Promise((resolve) => setTimeout(resolve, 650));
            if (groupID) {
                bot.sendMessage(msg.chat.id, "always have been");
            }
        }
        if (msg.text && msg.text.toLowerCase() === "print last seen") {
            await new Promise((resolve) => setTimeout(resolve, 650));
            if (groupID) {
                let message;
                const lastSeenValues = await getLastSeenValues();
                if (!lastSeenValues || !lastSeenValues.txHash) {
                    message = "¯⧵_(ツ)_/¯ ";
                }
                else {
                    message = getLastSeenMessage(lastSeenValues.txHash, lastSeenValues.txTimestamp);
                }
                eventEmitter.emit("newMessage", message);
            }
        }
    });
}
//# sourceMappingURL=TelegramBot.js.map