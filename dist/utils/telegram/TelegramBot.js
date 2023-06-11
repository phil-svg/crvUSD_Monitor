import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
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
function send(bot, message, groupID) {
    const key = `${groupID}:${message}`;
    if (sentMessages[key]) {
        console.log("This message has already been sent to this group in the past 30 seconds.");
        return;
    }
    bot.sendMessage(groupID, message, { parse_mode: "HTML", disable_web_page_preview: "true" });
    // Track the message as sent
    sentMessages[key] = true;
    // Delete the message from tracking after 30 seconds
    setTimeout(() => {
        delete sentMessages[key];
    }, 30000); // 30000 ms = 30 seconds
}
function shortenAddress(address) {
    return address.slice(0, 5) + ".." + address.slice(-2);
}
export async function buildLiquidateMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, dollarAmount, liquidator, crvUSD_amount, user, stablecoin_received, collateral_received, txHash, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const liquidatorURL = getBuyerURL(liquidator);
    const shortenLiquidator = shortenAddress(liquidator);
    const userURL = getBuyerURL(user);
    const shortenUser = shortenAddress(user);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    const AMM_URL = getPoolURL("0x136e783846ef68C8Bd00a3369F787dF8d683a696");
    const CONTROLLER_URL = getPoolURL("0x8472A9A7632b173c8Cf3a86D3afec50c35548e76");
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let liquidated = `liquidated ${hyperlink(userURL, shortenUser)}`;
    if (liquidator === user)
        liquidated = `self-liquidated`;
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(liquidatorURL, shortenLiquidator)} ${liquidated} with ${formatForPrint(crvUSD_amount)}${hyperlink(crvUSD_URL, "crvUSD")} and received: ${formatForPrint(collateral_received)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddon}
The${hyperlink(AMM_URL, "AMM")} send ${formatForPrint(stablecoin_received)}${hyperlink(crvUSD_URL, "crvUSD")} to the${hyperlink(CONTROLLER_URL, "Controller")}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildRemoveCollateralMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, dollarAmount, collateral_decrease, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddon}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildRepayMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_decrease, loan_decrease, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat;
    if (collateral_decrease > 0 && loan_decrease > 1) {
        didWhat = `repayed ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)} and ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (collateral_decrease > 0) {
        didWhat = `repayed ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}`;
    }
    else if (loan_decrease >= 0) {
        didWhat = `repayed ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}
export async function buildBorrowMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_increase, loan_increase, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat;
    if (collateral_increase > 0 && loan_increase > 1) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)} and borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (collateral_increase > 0) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)}`;
    }
    else if (loan_increase >= 0) {
        didWhat = `borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}
export async function buildWithdrawMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, withdrawnAmountcrvUSD, withdrawnAmountsCollat, txHash, buyer, crvUSDinCirculation, borrowRate, } = formattedEventData;
    const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    let removedWhat;
    if (withdrawnAmountcrvUSD >= 0 && withdrawnAmountsCollat === 0) {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (withdrawnAmountcrvUSD >= 0 && withdrawnAmountsCollat >= 0) {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(crvUSD_URL, "crvUSD")} and ${formatForPrint(withdrawnAmountsCollat)}${hyperlink(COLLATERAL_URL, collateralName)}`;
    }
    else {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(COLLATERAL_URL, collateralName)}`;
    }
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${removedWhat}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildDepositMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, borrowedAmount, txHash, buyer, crvUSDinCirculation, borrowRate } = formattedEventData;
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const COLLATERAL_URL = getTokenURL(collateralAddress);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    borrowedAmount = formatForPrint(borrowedAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} deposited ${borrowedAmount}${hyperlink(COLLATERAL_URL, collateralName)}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
async function buildSwapRouterMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralName, numberOfcrvUSDper1_collat, collateral_price, soldAddress, boughtAddress, txHash, buyer, soldAmount, boughtAmount, dollarAmount, tokenSoldName, tokenBoughtName, crvUSDinCirculation, borrowRate, } = formattedEventData;
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
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}
export async function buildTokenExchangeMessage(formattedEventData) {
    let { marketCap, qtyCollat, collatValue, marketBorrowedAmount, collateralName, numberOfcrvUSDper1_collat, collateral_price, soldAddress, boughtAddress, txHash, buyer, soldAmount, boughtAmount, dollarAmount, tokenSoldName, tokenBoughtName, crvUSDinCirculation, profit, revenue, cost, researchPositionHealth, borrowRate, } = formattedEventData;
    const SWAP_ROUTER = "0x99a58482BD75cbab83b27EC03CA68fF489b5788f";
    if (buyer.toLowerCase() === SWAP_ROUTER.toLowerCase())
        return await buildSwapRouterMessage(formattedEventData);
    let tokenInURL = getTokenURL(soldAddress);
    let tokenOutURL = getTokenURL(boughtAddress);
    let buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
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
    let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
${profitPrint}
1 ${collateralName} ➛ ${formatForPrint(collateral_price)} Dollar | ${formatForPrint(numberOfcrvUSDper1_collat)} crvUSD
Research Pos. Health: ${formatForPrint(researchPositionHealth * 100)} 🔭
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
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
    });
}
//# sourceMappingURL=TelegramBot.js.map