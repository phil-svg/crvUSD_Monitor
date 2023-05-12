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
function italic(string) {
    return "<i>" + string + "</i>";
}
function roundToNearest(num) {
    if (num < 100) {
        return Math.ceil(num / 10) * 10;
    }
    else if (num < 1000) {
        return Math.ceil(num / 100) * 100;
    }
    else {
        return Math.ceil(num / 1000) * 1000;
    }
}
function formatForPrint(someNumber) {
    if (typeof someNumber === "string" && someNumber.includes(","))
        return someNumber;
    someNumber = Math.abs(someNumber);
    if (someNumber > 100) {
        someNumber = Number(Number(someNumber).toFixed(0)).toLocaleString();
    }
    else if (someNumber > 5) {
        someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
    }
    else {
        someNumber = Number(Number(someNumber).toFixed(3)).toLocaleString();
    }
    return someNumber;
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
export function send(bot, message, groupID) {
    bot.sendMessage(groupID, message, { parse_mode: "HTML", disable_web_page_preview: "true" });
}
function shortenAddress(address) {
    return address.slice(0, 5) + ".." + address.slice(-2);
}
export async function buildLiquidateMessage(formattedEventData) {
    let { dollarAmount, liquidator, crvUSD_amount, user, stablecoin_received, collateral_received, txHash, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_crvUSD = "0xf71040d20Cc3FFBb28c1abcEF46134C7936624e0";
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const liquidatorURL = getBuyerURL(liquidator);
    const shortenLiquidator = shortenAddress(liquidator);
    const userURL = getBuyerURL(user);
    const shortenUser = shortenAddress(user);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    const AMM_URL = getPoolURL("0x77fCFB78151c676f390a6236A78b5d3152e43384");
    const CONTROLLER_URL = getPoolURL("0xCdEdbd0AD036C046eDB19576ee65ea96b26075b1");
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let liquidated = `liquidated ${hyperlink(userURL, shortenUser)}`;
    if (liquidator === user)
        liquidated = `self-liquidated`;
    return `
  🚀${hyperlink(liquidatorURL, shortenLiquidator)} ${liquidated} with ${formatForPrint(crvUSD_amount)}${hyperlink(crvUSD_URL, "crvUSD")} and received: ${formatForPrint(collateral_received)}${hyperlink(sfrxETH_URL, "sfrxETH")}${dollarAddon}
The${hyperlink(AMM_URL, "AMM")} send ${formatForPrint(stablecoin_received)}${hyperlink(crvUSD_URL, "crvUSD")} to the${hyperlink(CONTROLLER_URL, "Controller")}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
`;
}
export async function buildRemoveCollateralMessage(formattedEventData) {
    let { dollarAmount, collateral_decrease, txHash, buyer, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    dollarAmount = formatForPrint(dollarAmount);
    var dollarAddon = getDollarAddOn(dollarAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${formatForPrint(collateral_decrease)}${hyperlink(sfrxETH_URL, "sfrxEth")}${dollarAddon}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
`;
}
export async function buildRepayMessage(formattedEventData) {
    let { collateral_decrease, loan_decrease, txHash, buyer, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_crvUSD = "0xf71040d20Cc3FFBb28c1abcEF46134C7936624e0";
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat;
    if (collateral_decrease > 0 && loan_decrease > 1) {
        didWhat = `repayed ${formatForPrint(collateral_decrease)}${hyperlink(sfrxETH_URL, "sfrxEth")} and ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (collateral_decrease > 0) {
        didWhat = `repayed ${formatForPrint(collateral_decrease)}${hyperlink(sfrxETH_URL, "sfrxEth")}`;
    }
    else if (loan_decrease >= 0) {
        didWhat = `repayed ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
  `;
}
export async function buildBorrowMessage(formattedEventData) {
    let { collateral_increase, loan_increase, txHash, buyer, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_crvUSD = "0xf71040d20Cc3FFBb28c1abcEF46134C7936624e0";
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    let didWhat;
    if (collateral_increase > 0 && loan_increase > 1) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(sfrxETH_URL, "sfrxEth")} and borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (collateral_increase > 0) {
        didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(sfrxETH_URL, "sfrxEth")}`;
    }
    else if (loan_increase >= 0) {
        didWhat = `borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
  `;
}
export async function buildWithdrawMessage(formattedEventData) {
    let { withdrawnAmountcrvUSD, withdrawnAmountsfrxETH, txHash, buyer, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_crvUSD = "0xf71040d20Cc3FFBb28c1abcEF46134C7936624e0";
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    let removedWhat;
    if (withdrawnAmountcrvUSD >= 0 && withdrawnAmountsfrxETH === 0) {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(crvUSD_URL, "crvUSD")}`;
    }
    else if (withdrawnAmountcrvUSD >= 0 && withdrawnAmountsfrxETH >= 0) {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(crvUSD_URL, "crvUSD")} and ${formatForPrint(withdrawnAmountsfrxETH)}${hyperlink(sfrxETH_URL, "sfrxEth")}`;
    }
    else {
        removedWhat = `${formatForPrint(withdrawnAmountcrvUSD)}${hyperlink(sfrxETH_URL, "sfrxEth")}`;
    }
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${removedWhat}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
`;
}
export async function buildDepositMessage(formattedEventData) {
    let { borrowedAmount, txHash, buyer, crvUSDinCirculation } = formattedEventData;
    const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";
    const buyerURL = getBuyerURL(buyer);
    const shortenBuyer = shortenAddress(buyer);
    const sfrxETH_URL = getTokenURL(ADDRESS_sfrxETH);
    const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
    const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
    borrowedAmount = formatForPrint(borrowedAmount);
    crvUSDinCirculation = formatForPrint(crvUSDinCirculation);
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} deposited ${borrowedAmount}${hyperlink(sfrxETH_URL, "sfrxETH")}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
`;
}
export async function buildTokenExchangeMessage(formattedEventData) {
    let { soldAddress, boughtAddress, txHash, buyer, soldAmount, boughtAmount, dollarAmount, tokenSoldName, tokenBoughtName, crvUSDinCirculation } = formattedEventData;
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
    else if (tokenSoldName === "sfrxETH") {
        swappedWhat = `de-liquidated ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)} with ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)}${dollarAddon}`;
    }
    return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
Marketcap crvUSD: ${crvUSDinCirculation} 
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "TxHash")} |${hyperlink(TX_HASH_URL_EIGENPHI, "EigenPhi")} 🦙🦙🦙
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