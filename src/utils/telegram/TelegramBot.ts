import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { EventEmitter } from "events";
import { labels } from "../../Labels.js";
import { get1InchV5MinAmountInfo, getSwap1InchMinAmountInfo } from "../helperFunctions/1Inch.js";
import { MIN_HARDLIQ_AMOUNT_WORTH_PRINTING, MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING, MIN_REPAYED_AMOUNT_WORTH_PRINTING } from "../../crvUSD_Bot.js";
import { ADDRESS_crvUSD, SWAP_ROUTER } from "../Constants.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getVaultName } from "../helperFunctions/Lending.js";
dotenv.config({ path: "../.env" });

function getTokenURL(tokenAddress: string) {
  return "https://etherscan.io/token/" + tokenAddress;
}

function getPoolURL(poolAddress: string) {
  return "https://etherscan.io/address/" + poolAddress;
}

function getTxHashURLfromEtherscan(txHash: string) {
  return "https://etherscan.io/tx/" + txHash;
}

function getTxHashURLfromEigenPhi(txHash: string) {
  return "https://eigenphi.io/mev/eigentx/" + txHash;
}

function getBuyerURL(buyerAddress: string) {
  return "https://etherscan.io/address/" + buyerAddress;
}

function getProfitPrint(profit: any, revenue: any, cost: any) {
  if (profit > revenue * 0.5) return `Revenue: ¯⧵_(ツ)_/¯`;
  if (profit === 0) return `Revenue: ¯⧵_(ツ)_/¯`;
  return `Profit: $${formatForPrint(profit)} | Revenue: $${formatForPrint(revenue)} | Cost: $${formatForPrint(cost)}`;
}

function getMarketHealthPrint(qtyCollat: number, collateralName: string, collatValue: number, marketBorrowedAmount: number) {
  collatValue = formatForPrint(collatValue);
  marketBorrowedAmount = formatForPrint(marketBorrowedAmount);
  qtyCollat = formatForPrint(qtyCollat);
  return `Collateral: ${getShortenNumber(qtyCollat)} ${collateralName}${getDollarAddOn(collatValue)} | Borrowed: ${getShortenNumber(marketBorrowedAmount)} crvUSD`;
}

function calculateBips(priceBefore: number, priceAfter: number): number {
  if (typeof priceBefore !== "number" || typeof priceAfter !== "number" || priceBefore === 0) {
    throw new Error("Invalid input: priceBefore and priceAfter must be numbers, and priceBefore must not be 0.");
  }

  const bips: number = ((priceAfter - priceBefore) / priceBefore) * 10000;
  return Number(bips.toFixed(4));
}

function formatForPrint(someNumber: any) {
  if (typeof someNumber === "string" && someNumber.includes(",")) return someNumber;
  //someNumber = Math.abs(someNumber);
  if (someNumber > 100) {
    someNumber = Number(Number(someNumber).toFixed(0)).toLocaleString();
  } else if (someNumber > 5) {
    someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
  } else {
    someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
  }
  return someNumber;
}

function getShortenNumber(amountStr: any) {
  let amount = parseFloat(amountStr.replace(/,/g, ""));
  //amount = roundToNearest(amount);
  if (amount >= 1000000) {
    const millionAmount = amount / 1000000;
    if (Number.isInteger(millionAmount)) {
      return `${millionAmount.toFixed(0)}M`;
    } else {
      return `${millionAmount.toFixed(2)}M`;
    }
  } else if (amount >= 1000) {
    const thousandAmount = amount / 1000;
    if (Number.isInteger(thousandAmount)) {
      return `${thousandAmount.toFixed(0)}k`;
    } else {
      return `${thousandAmount.toFixed(1)}k`;
    }
  } else {
    return `${amount.toFixed(2)}`;
  }
}

function getShortenNumberFixed(amount: number): string {
  if (amount >= 1_000_000) {
    const millionAmount = amount / 1_000_000;
    return `${millionAmount.toFixed(millionAmount % 1 === 0 ? 0 : 2)}M`;
  } else if (amount >= 1000) {
    const thousandAmount = amount / 1000;
    return `${thousandAmount.toFixed(0)}k`;
  } else if (amount === 0) {
    return `${amount}`;
  } else {
    return `${amount.toFixed(2)}`;
  }
}

function getDollarAddOn(amountStr: any) {
  let amount = amountStr;
  if (typeof amount === "string") {
    amount = parseFloat(amountStr.replace(/,/g, ""));
  }
  //amount = roundToNearest(amount);
  if (amount >= 1000000) {
    const millionAmount = amount / 1000000;
    if (Number.isInteger(millionAmount)) {
      return ` ($${millionAmount.toFixed(0)}M)`;
    } else {
      return ` ($${millionAmount.toFixed(2)}M)`;
    }
  } else if (amount >= 1000) {
    const thousandAmount = amount / 1000;
    if (Number.isInteger(thousandAmount)) {
      return ` ($${thousandAmount.toFixed(0)}k)`;
    } else {
      return ` ($${thousandAmount.toFixed(1)}k)`;
    }
  } else {
    return ` ($${amount.toFixed(2)})`;
  }
}

function hyperlink(link: string, name: string): string {
  return "<a href='" + link + "/'> " + name + "</a>";
}

let sentMessages: Record<string, boolean> = {};
export function send(bot: any, message: string, groupID: number) {
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

function shortenAddress(address: string): string {
  return address.slice(0, 5) + ".." + address.slice(-2);
}

function getAddressName(address: string): string {
  // Find label for address
  const labelObject = labels.find((label: { Address: string }) => label.Address.toLowerCase() === address.toLowerCase());

  // If label found, return it. Otherwise, return shortened address
  return labelObject ? labelObject.Label : shortenAddress(address);
}

export async function buildLiquidateMessage(formattedEventData: any, controllerAddress: string, ammAddress: string) {
  let {
    crvUSD_price,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    dollarAmount,
    liquidator,
    crvUSD_amount,
    user,
    stablecoin_received,
    collateral_received,
    txHash,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;

  if (stablecoin_received < MIN_HARDLIQ_AMOUNT_WORTH_PRINTING) return "don't print tiny hard-liquidations";

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

  const botRevenue = formatForPrint(dollarAmount - crvUSD_amount * crvUSD_price);

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  let liquidated = `hard-liquidated ${hyperlink(userURL, shortenUser)}`;
  let revOrLossMessage = `Bot Revenue: $${botRevenue}`;

  if (liquidator === user) {
    liquidated = `self-liquidated`;
    revOrLossMessage = `User loss: ¯⧵_(ツ)_/¯`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  return `
  User${hyperlink(liquidatorURL, shortenLiquidator)} ${liquidated} with ${formatForPrint(crvUSD_amount)}${hyperlink(crvUSD_URL, "crvUSD")} and ${formatForPrint(
    collateral_received
  )}${hyperlink(COLLATERAL_URL, collateralName)}
The${hyperlink(AMM_URL, "AMM")} send ${formatForPrint(stablecoin_received)}${hyperlink(crvUSD_URL, "crvUSD")} to the${hyperlink(CONTROLLER_URL, "Controller")}
${revOrLossMessage}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export async function buildRemoveCollateralMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    borrowerHealth,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    dollarAmount,
    collateral_decrease,
    txHash,
    buyer,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;

  if (dollarAmount < MIN_REPAYED_AMOUNT_WORTH_PRINTING) return "don't print small amounts";

  const buyerURL = getBuyerURL(buyer);
  const shortenBuyer = getAddressName(buyer);
  const COLLATERAL_URL = getTokenURL(collateralAddress);
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  dollarAmount = formatForPrint(dollarAmount);
  var dollarAddon = getDollarAddOn(dollarAmount);

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  if (borrowerHealth !== "no loan") borrowerHealth = formatForPrint(borrowerHealth * 100);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddon}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export async function buildRepayMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    borrowerHealth,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    collateral_decrease,
    loan_decrease,
    txHash,
    buyer,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;

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

  if (borrowerHealth !== "no loan") borrowerHealth = formatForPrint(borrowerHealth * 100);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}

export async function buildBorrowMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    borrowerHealth,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    collateral_increase,
    collateral_increase_value,
    loan_increase,
    txHash,
    buyer,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;
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
    didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddonCollat} and borrowed ${formatForPrint(
      loan_increase
    )}${hyperlink(crvUSD_URL, "crvUSD")}`;
  } else if (collateral_increase > 0) {
    didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(COLLATERAL_URL, collateralName)}${dollarAddonCollat}`;
  } else if (loan_increase >= 0) {
    if (loan_increase < MIN_REPAYED_AMOUNT_WORTH_PRINTING) return "don't print tiny liquidations";
    didWhat = `borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, "crvUSD")}`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  if (borrowerHealth !== "no loan") borrowerHealth = formatForPrint(borrowerHealth * 100);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
  `;
}

export async function buildDepositMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    borrowerHealth,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    borrowedAmount,
    txHash,
    buyer,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;

  const buyerURL = getBuyerURL(buyer);
  const shortenBuyer = getAddressName(buyer);
  const COLLATERAL_URL = getTokenURL(collateralAddress);
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  borrowedAmount = formatForPrint(borrowedAmount);

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  if (borrowerHealth !== "no loan") borrowerHealth = formatForPrint(borrowerHealth * 100);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} deposited ${borrowedAmount}${hyperlink(COLLATERAL_URL, collateralName)}
Health of Borrower: ${borrowerHealth}
Borrow Rate: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

async function buildSwapRouterMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralName,
    numberOfcrvUSDper1_collat,
    collateral_price,
    soldAddress,
    boughtAddress,
    txHash,
    buyer,
    soldAmount,
    boughtAmount,
    dollarAmount,
    tokenSoldName,
    tokenBoughtName,
    crvUSDinCirculation,
    borrowRate,
  } = formattedEventData;

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
  } else if (tokenSoldName === collateralName) {
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

export async function buildTokenExchangeMessage(formattedEventData: any) {
  let {
    crvUSD_price,
    marketCap,
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralName,
    numberOfcrvUSDper1_collat,
    collateral_price,
    soldAddress,
    boughtAddress,
    txHash,
    buyer,
    soldAmount,
    boughtAmount,
    dollarAmount,
    tokenSoldName,
    tokenBoughtName,
    crvUSDinCirculation,
    profit,
    revenue,
    cost,
    borrowRate,
  } = formattedEventData;

  // console.log("entered buildTokenExchangeMessage with:", formattedEventData);

  if (buyer.toLowerCase() === SWAP_ROUTER.toLowerCase()) return await buildSwapRouterMessage(formattedEventData);

  let tokenInURL = getTokenURL(soldAddress);
  let tokenOutURL = getTokenURL(boughtAddress);
  let buyerURL = getBuyerURL(buyer);

  const shortenBuyer = getAddressName(buyer);

  if (dollarAmount < MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING) return "don't print tiny liquidations";

  soldAmount = formatForPrint(soldAmount);
  boughtAmount = formatForPrint(boughtAmount);
  dollarAmount = formatForPrint(dollarAmount);

  var dollarAddon = getDollarAddOn(dollarAmount);

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  let swappedWhat;
  if (tokenSoldName === "crvUSD") {
    swappedWhat = `soft-liquidated ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)} with ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)}${dollarAddon}`;
  } else if (tokenSoldName === collateralName) {
    swappedWhat = `de-liquidated ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)} with ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)}${dollarAddon}`;
  }

  let profitPrint = getProfitPrint(profit, revenue, cost);
  if (shortenBuyer === "1Inch") {
    let _1Inchdetails = await getSwap1InchMinAmountInfo(txHash);
    profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${_1Inchdetails.tokenInName} to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${
      _1Inchdetails.tokenOutName
    }`;
  } else if (shortenBuyer === "1inch v5: Aggregation Router") {
    let _1Inchdetails = await get1InchV5MinAmountInfo(txHash);
    profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${_1Inchdetails.tokenInName} to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${
      _1Inchdetails.tokenOutName
    }`;
  }
  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
${profitPrint}
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(formatForPrint(crvUSDinCirculation))} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
/////////////////// PEG-KEEPER /////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

export type PegKeeperMessageContext = {
  event: "Provide" | "Withdraw"; // Assuming these are the only two event types
  amount: number; // Total amount bought or sold
  priceBefore: number; // Price of crvUSD before the event
  priceAfter: number; // Price of crvUSD after the event
};

type PegKeeperDetail = {
  coinSymbol: string | null;
  address: string;
  debtAtBlock: number | null;
  debtAtPreviousBlock: number | null;
};

export function buildPegKeeperMessage(pegKeeperDetails: PegKeeperDetail[], context: PegKeeperMessageContext, txHash: string): string {
  let messageParts: string[] = [];
  let totalBefore = 0;
  let totalAfter = 0;

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  // Find the first peg keeper with a change in debt
  const significantPegKeeper = pegKeeperDetails.find(
    (detail) => detail.debtAtBlock !== null && detail.debtAtPreviousBlock !== null && detail.debtAtBlock !== detail.debtAtPreviousBlock
  );

  // Generate a URL for the significant peg keeper, default to "#" if not found
  const pegkeeperURL = significantPegKeeper ? getPoolURL(significantPegKeeper.address) : "#";
  // Use the coin symbol of the significant peg keeper for the action line, default to "Pegkeeper/crvUSD" if not found
  const actionLineCoinSymbol = significantPegKeeper?.coinSymbol ? `${significantPegKeeper.coinSymbol}/crvUSD` : "Pegkeeper/crvUSD";

  // Formatting the first line based on the event type
  const action = context.event === "Provide" ? "buffered" : "released";
  const formattedAmount = getShortenNumberFixed(context.amount);

  // Constructing the summary line with hyperlink
  const summaryLine = `🛡 Pegkeeper${hyperlink(pegkeeperURL, actionLineCoinSymbol)} ${action} ${formattedAmount}${crvUSD_Link}\n`;

  messageParts.push(summaryLine);

  pegKeeperDetails.sort((a, b) => (a.coinSymbol || "").localeCompare(b.coinSymbol || ""));

  for (const detail of pegKeeperDetails) {
    if (detail.coinSymbol && detail.debtAtBlock !== null && detail.debtAtPreviousBlock !== null) {
      const beforeDebt = detail.debtAtPreviousBlock;
      const afterDebt = detail.debtAtBlock;
      totalBefore += Number(detail.debtAtPreviousBlock);
      totalAfter += Number(detail.debtAtBlock);

      // Generate URL for each peg keeper detail
      const detailURL = getPoolURL(detail.address);
      let debtChangeMessage = `${hyperlink(detailURL, `${detail.coinSymbol}/crvUSD`)} ${getShortenNumberFixed(beforeDebt)}`;
      if (detail.debtAtPreviousBlock !== detail.debtAtBlock) {
        debtChangeMessage += ` ➠ ${getShortenNumberFixed(afterDebt)}`;
      }

      messageParts.push(debtChangeMessage);
    }
  }

  const totalMessage = `\nTotal buffered: ${getShortenNumberFixed(totalBefore)} ➠ ${getShortenNumberFixed(totalAfter)}${crvUSD_Link}`;
  messageParts.push(totalMessage);

  const txHashURLfromEtherscan = getTxHashURLfromEtherscan(txHash);
  const txHashLinkEtherscan = hyperlink(txHashURLfromEtherscan, "etherscan.io");
  const txHashURLfromEigenPhi = getTxHashURLfromEigenPhi(txHash);
  const txHashLinkEigenphi = hyperlink(txHashURLfromEigenPhi, "eigenphi.io");
  const links = `Links:${txHashLinkEtherscan} |${txHashLinkEigenphi} 🦙🦙🦙`;
  messageParts.push(links);

  return messageParts.join("\n");
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
/////////////////// PEG-KEEPER END//////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
/////////////////// LENDING-MARKET START////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

function getLlamaLendPositionHealthLine(positionHealth: number): string {
  if (!positionHealth) return `Health of Position: no loan`;
  if (positionHealth > 100) return `Health of Position: no loan`;
  return `Health of Position: ${positionHealth.toFixed(2)}`;
}

export function buildLendingMarketDepositMessage(
  lendingMarketAddress: string,
  txHash: string,
  agentAddress: string,
  parsedDepositAmount: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const vaultURL = getPoolURL(lendingMarketAddress);
  const vaultName = getVaultName(lendingMarketAddress);

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  return `
  LlamaLend event in${hyperlink(vaultURL, vaultName)} 📪

🚀${hyperlink(agentURL, shortenAgent)} deposited ${formatForPrint(parsedDepositAmount)}${crvUSD_Link} into${hyperlink(vaultURL, vaultName)}
Borrow APR: ${borrowApr.toFixed(2)}% | Lend APR: ${lendApr.toFixed(2)}%
Total Assets in ${vaultName}: ${Number(totalAssets.toFixed(0)).toLocaleString()}${crvUSD_Link}
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export function buildLendingMarketWithdrawMessage(txHash: string): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  return `
   Withdrawal happened 
   (todo)
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

// CONTROLLER-MESSAGES

export function buildLendingMarketBorrowMessage(
  txHash: string,
  agentAddress: string,
  parsedBorrowedAmount: number,
  parsedCollatAmount: number,
  collatName: string,
  collatAddress: string,
  positionHealth: number,
  lendingMarketAddress: string,
  totalDebtInMarket: number,
  collatDollarAmount: number,
  dollarAmountBorrow: number
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  const collat_URL = getTokenURL(collatAddress);
  const collat_Link = hyperlink(collat_URL, collatName);

  const vaultURL = getPoolURL(lendingMarketAddress);
  const vaultName = getVaultName(lendingMarketAddress);

  const dollarAddon = getDollarAddOn(collatDollarAmount);
  const dollarAddonBorrow = getDollarAddOn(dollarAmountBorrow);

  let userLine;
  if (parsedCollatAmount < 1) {
    userLine = `User${hyperlink(agentURL, shortenAgent)} borrowed ${formatForPrint(parsedBorrowedAmount)}${crvUSD_Link}${dollarAddonBorrow}`;
  } else if (parsedBorrowedAmount < 1) {
    userLine = `User${hyperlink(agentURL, shortenAgent)} added ${formatForPrint(parsedCollatAmount)}${collat_Link}${dollarAddon}`;
  } else {
    userLine = `User${hyperlink(agentURL, shortenAgent)} borrowed ${formatForPrint(parsedBorrowedAmount)}${crvUSD_Link} and added ${formatForPrint(
      parsedCollatAmount
    )}${collat_Link}${dollarAddon}`;
  }

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  return `
  LlamaLend event in${hyperlink(vaultURL, vaultName)} 📪

${userLine}
${positionHealthLine}
Total Debt in${hyperlink(vaultURL, vaultName)}: ${Number(totalDebtInMarket.toFixed(0)).toLocaleString()}${crvUSD_Link}
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export function buildLendingMarketRepayMessage(
  txHash: string,
  lendingMarketAddress: string,
  positionHealth: number,
  totalDebtInMarket: number,
  agentAddress: string,
  parsedRepayAmount: number,
  collatName: string,
  collatAddress: string,
  collatDollarAmount: number,
  parsedCollatAmount: number,
  repayDollarAmount: number
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(lendingMarketAddress);
  const vaultName = getVaultName(lendingMarketAddress);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const collat_URL = getTokenURL(collatAddress);
  const collat_Link = hyperlink(collat_URL, collatName);

  const collatDollarAddon = getDollarAddOn(collatDollarAmount);
  const repayDollarAddon = getDollarAddOn(repayDollarAmount);

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  let userLine;
  userLine = `User${hyperlink(agentURL, shortenAgent)} repaid ${Number(parsedRepayAmount.toFixed(0)).toLocaleString()}${crvUSD_Link}${repayDollarAddon} and received ${Number(
    parsedCollatAmount.toFixed(0)
  ).toLocaleString()}${collat_Link}${collatDollarAddon}`;

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  return `
  LlamaLend event in${hyperlink(vaultURL, vaultName)} 📪

${userLine}
${positionHealthLine}
Total Debt in${hyperlink(vaultURL, vaultName)}: ${Number(totalDebtInMarket.toFixed(0)).toLocaleString()}${crvUSD_Link}
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export function buildLendingMarketRemoveCollateralMessage(
  parsedCollatRemovalAmount: number,
  txHash: string,
  lendingMarketAddress: string,
  agentAddress: string,
  positionHealth: number,
  collatDollarAmount: number,
  collatAddress: string,
  collatName: string,
  totalDebtInMarket: number
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(lendingMarketAddress);
  const vaultName = getVaultName(lendingMarketAddress);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  const collat_URL = getTokenURL(collatAddress);
  const collat_Link = hyperlink(collat_URL, collatName);

  const collatDollarAddOn = getDollarAddOn(collatDollarAmount);

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  return `
LlamaLend event in${hyperlink(vaultURL, vaultName)} 📪

User${hyperlink(agentURL, shortenAgent)} removed ${Number(parsedCollatRemovalAmount.toFixed(0)).toLocaleString()}${collat_Link}${collatDollarAddOn}
${positionHealthLine}
Total Debt in${hyperlink(vaultURL, vaultName)}: ${Number(totalDebtInMarket.toFixed(0)).toLocaleString()}${crvUSD_Link}
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export function buildLendingMarketHardLiquidateMessage(txHash: string): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  return `
   Hard-Liquidation happened 
   (todo)
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

export function buildSoftLiquidateMessage(
  txHash: string,
  lendingMarketAddress: string,
  agentAddress: string,
  parsedSoftLiquidatedAmount: number,
  collatAddress: string,
  collatName: string,
  collatDollarAmount: number,
  parsedRepaidAmount: number,
  repaidCrvUSDDollarAmount: number
): string {
  const vaultURL = getPoolURL(lendingMarketAddress);
  const vaultName = getVaultName(lendingMarketAddress);

  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const collat_URL = getTokenURL(collatAddress);
  const collat_Link = hyperlink(collat_URL, collatName);

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, "crvUSD");

  const collatDollarAddOn = getDollarAddOn(collatDollarAmount);

  const repaidTokenDollarAddOn = getDollarAddOn(repaidCrvUSDDollarAmount);

  const discountAmount = collatDollarAmount - repaidCrvUSDDollarAmount;

  let direction;
  if (collatDollarAmount > repaidCrvUSDDollarAmount) {
    direction = "soft";
  } else {
    direction = "de";
  }

  return `
LlamaLend event in${hyperlink(vaultURL, vaultName)} 📪

User${hyperlink(agentURL, shortenAgent)} ${direction}-liquidated ${Number(parsedSoftLiquidatedAmount.toFixed(0)).toLocaleString()}${collat_Link}${collatDollarAddOn} with ${Number(
    parsedRepaidAmount.toFixed(0)
  ).toLocaleString()}${crvUSD_Link}${repaidTokenDollarAddOn}
Discount: $${Number(discountAmount.toFixed(0)).toLocaleString()}
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, "etherscan.io")} |${hyperlink(TX_HASH_URL_EIGENPHI, "eigenphi.io")} 🦙🦙🦙
`;
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
/////////////////// LENDING-MARKET END//////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

async function getLastSeenValues() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, "../../../lastSeen.json");
    const data = JSON.parse(await readFile(filePath, "utf-8"));

    return {
      txHash: data.txHash,
      txTimestamp: new Date(data.txTimestamp),
    };
  } catch (error) {
    console.error("Error reading last seen data from file:", error);
    return null;
  }
}

function getTimeMessage(timestamp: Date): string {
  if (!timestamp) return "never seen"; // If no transaction was seen

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

function getLastSeenMessage(txHash: string, timestamp: Date) {
  const timeMessage = getTimeMessage(timestamp);
  const message = `The last seen crvUSD${hyperlink(getTxHashURLfromEtherscan(txHash), "tx")} was ${timeMessage}`;
  return message;
}

let intervalId: NodeJS.Timeout | null = null;

async function getLastSeenMessageContent(): Promise<string> {
  const lastSeenValues = await getLastSeenValues();

  if (!lastSeenValues || !lastSeenValues.txHash) {
    return "¯⧵_(ツ)_/¯ ";
  }

  return getLastSeenMessage(lastSeenValues.txHash, lastSeenValues.txTimestamp);
}

// prints sharpy updates at h:00, h:15, h:30, h:45
async function botMonitoringIntervalPrint(bot: any) {
  // If the interval is already set, return immediately.
  if (intervalId) return;

  const groupID = -1001929399603;

  const sendBotMessage = async () => {
    const message = await getLastSeenMessageContent();
    bot.sendMessage(groupID, message, { parse_mode: "HTML", disable_web_page_preview: "true" });
  };

  const currentMinute = new Date().getMinutes();
  let minutesUntilNextQuarter = 15 - (currentMinute % 15);
  let timeoutDuration = minutesUntilNextQuarter * 60 * 1000; // Duration until next quarter hour in milliseconds.

  setTimeout(() => {
    sendBotMessage();
    intervalId = setInterval(sendBotMessage, 15 * 60 * 1000); // Set 15 minutes interval after the first message.
  }, timeoutDuration);
}

export async function processLastSeen(eventEmitter: EventEmitter) {
  const message = await getLastSeenMessageContent();
  eventEmitter.emit("newMessage", message);
}

export async function telegramBotMain(env: string, eventEmitter: EventEmitter) {
  eventEmitter.on("newMessage", (message: string) => {
    if (groupID) {
      send(bot, message, parseInt(groupID));
    }
  });

  let telegramGroupToken: string | undefined;
  let groupID: string | undefined;

  if (env == "prod") {
    telegramGroupToken = process.env.TELEGRAM_CRVUSD_PROD_KEY!;
    groupID = process.env.TELEGRAM_PROD_GROUP_ID!;
  }
  if (env == "test") {
    telegramGroupToken = process.env.TELEGRAM_CRVUSD_TEST_KEY!;
    groupID = process.env.TELEGRAM_TEST_GROUP_ID!;
  }

  const bot = new TelegramBot(telegramGroupToken!, { polling: true });

  botMonitoringIntervalPrint(bot);

  bot.on("message", async (msg) => {
    if (msg.text === "bot u with us") {
      await new Promise((resolve) => setTimeout(resolve, 650));
      if (groupID) {
        bot.sendMessage(msg.chat.id, "always have been");
      }
    }
    if (msg && msg.text && msg.text.toLowerCase() === "print last seen") {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await processLastSeen(eventEmitter);
    }
  });
}
