import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { labels } from '../../Labels.js';
import { get1InchV5MinAmountInfo, getSwap1InchMinAmountInfo } from '../helperFunctions/1Inch.js';
import {
  MIN_HARDLIQ_AMOUNT_WORTH_PRINTING,
  MIN_LIQUIDATION_AMOUNT_WORTH_PRINTING,
  MIN_REPAYED_AMOUNT_WORTH_PRINTING,
} from '../../crvUSD_Bot.js';
import { ADDRESS_crvUSD, SWAP_ROUTER } from '../Constants.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EnrichedLendingMarketEvent } from '../Interfaces.js';
import { generateDefiSaverUrl } from '../defisaver/DefiSaver.js';
import { calculateAPYFromAPR } from '../helperFunctions/LLAMMA.js';
dotenv.config({ path: '../.env' });

function getTokenURL(tokenAddress: string) {
  return 'https://etherscan.io/token/' + tokenAddress;
}

function getPoolURL(poolAddress: string) {
  return 'https://etherscan.io/address/' + poolAddress;
}

function getTxHashURLfromEtherscan(txHash: string) {
  return 'https://etherscan.io/tx/' + txHash;
}

function getTxHashURLfromEigenPhi(txHash: string) {
  return 'https://eigenphi.io/mev/eigentx/' + txHash;
}

function getBuyerURL(buyerAddress: string) {
  return 'https://etherscan.io/address/' + buyerAddress;
}

function getCurveLendingURL(id: string): string {
  return `https://lend.curve.fi/#/ethereum/markets/one-way-market-${id}/create/`;
}

function getProfitPrint(profit: any, revenue: any, cost: any) {
  if (profit > revenue * 0.5) return `Revenue: ¯⧵_(ツ)_/¯`;
  if (profit === 0) return `Revenue: ¯⧵_(ツ)_/¯`;
  return `Profit: $${formatForPrint(profit)} | Revenue: $${formatForPrint(revenue)} | Cost: $${formatForPrint(cost)}`;
}

function getMarketHealthPrint(
  qtyCollat: number,
  collateralName: string,
  collatValue: number,
  marketBorrowedAmount: number
) {
  collatValue = formatForPrint(collatValue);
  marketBorrowedAmount = formatForPrint(marketBorrowedAmount);
  qtyCollat = formatForPrint(qtyCollat);
  return `Collateral: ${getShortenNumber(qtyCollat)} ${collateralName}${getDollarAddOn(
    collatValue
  )} | Borrowed: ${getShortenNumber(marketBorrowedAmount)} crvUSD`;
}

function calculateBips(priceBefore: number, priceAfter: number): number {
  if (typeof priceBefore !== 'number' || typeof priceAfter !== 'number' || priceBefore === 0) {
    throw new Error('Invalid input: priceBefore and priceAfter must be numbers, and priceBefore must not be 0.');
  }

  const bips: number = ((priceAfter - priceBefore) / priceBefore) * 10000;
  return Number(bips.toFixed(4));
}

function formatForPrint(someNumber: any) {
  if (typeof someNumber === 'string' && someNumber.includes(',')) return someNumber;
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
  let amount = parseFloat(amountStr.replace(/,/g, ''));
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
  if (typeof amount === 'string') {
    amount = parseFloat(amountStr.replace(/,/g, ''));
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
  return "<a href='" + link + "/'> " + name + '</a>';
}

function improveMessageContent(message: string): string {
  const replacements: { [key: string]: string } = {
    undefined: 'not available',
    NaN: 'not available',
  };

  let improvedMessage = message;
  for (const [keyword, replacement] of Object.entries(replacements)) {
    improvedMessage = improvedMessage.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), replacement);
  }

  return improvedMessage;
}

let sentMessages: Record<string, boolean> = {};
export function send(bot: any, message: string, groupID: number) {
  const key = `${groupID}:${message}`;

  if (sentMessages[key]) {
    // console.log("This message has already been sent to this group in the past 30 seconds.");
    return;
  }

  let improvedMessage = improveMessageContent(message);

  bot.sendMessage(groupID, improvedMessage, { parse_mode: 'HTML', disable_web_page_preview: 'true' });

  if (!message.startsWith('last seen')) {
    // Track the message as sent
    sentMessages[key] = true;

    // Delete the message from tracking after 30 seconds
    setTimeout(() => {
      delete sentMessages[key];
    }, 30000); // 30000 ms = 30 seconds
  }
}

function shortenAddress(address: string): string {
  return address.slice(0, 5) + '..' + address.slice(-2);
}

function getAddressName(address: string): string {
  // Find label for address
  const labelObject = labels.find(
    (label: { Address: string }) => label.Address.toLowerCase() === address.toLowerCase()
  );

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
    botRevenue,
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

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  let liquidated = `hard-liquidated ${hyperlink(userURL, shortenUser)}`;
  let revOrLossMessage = `Bot Revenue: $${formatForPrint(botRevenue)}`;

  if (liquidator === user) {
    liquidated = `self-liquidated`;
    revOrLossMessage = `User loss: ¯⧵_(ツ)_/¯`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  return `
  User${hyperlink(liquidatorURL, shortenLiquidator)} ${liquidated} with ${formatForPrint(crvUSD_amount)}${hyperlink(
    crvUSD_URL,
    'crvUSD'
  )} and ${formatForPrint(collateral_received)}${hyperlink(COLLATERAL_URL, collateralName)}
The${hyperlink(AMM_URL, 'AMM')} send ${formatForPrint(stablecoin_received)}${hyperlink(
    crvUSD_URL,
    'crvUSD'
  )} to the${hyperlink(CONTROLLER_URL, 'Controller')}
${revOrLossMessage}
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
`;
}

export async function buildRemoveCollateralMessage(
  formattedEventData: any,
  isDefiSaverAutomatedTx: boolean,
  isManualSmartWalletTx: boolean,
  defiSaverUser: string
) {
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

  if (borrowerHealth !== 'no loan') borrowerHealth = formatForPrint(borrowerHealth * 100);

  let healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}`;
  if (isManualSmartWalletTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Manually via${hyperlink(url, 'defisaver.com')} 🛟`;
  } else if (isDefiSaverAutomatedTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Automated via${hyperlink(url, 'defisaver.com')} 🛟`;
  }

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} removed ${formatForPrint(collateral_decrease)}${hyperlink(
    COLLATERAL_URL,
    collateralName
  )}${dollarAddon}
${healthAndDefiSaverLine}
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
`;
}

export async function buildRepayMessage(
  formattedEventData: any,
  isDefiSaverAutomatedTx: boolean,
  isManualSmartWalletTx: boolean,
  defiSaverUser: string
) {
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

  let didWhat = `repayed ${formatForPrint(loan_decrease)}${hyperlink(crvUSD_URL, 'crvUSD')}`;
  if (collateral_decrease > 0 && loan_decrease > 1) {
    didWhat += ` and received ${formatForPrint(collateral_decrease)}${hyperlink(COLLATERAL_URL, collateralName)}`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  if (borrowerHealth !== 'no loan') borrowerHealth = formatForPrint(borrowerHealth * 100);

  let healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}`;
  if (isManualSmartWalletTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Manually via${hyperlink(url, 'defisaver.com')} 🛟`;
  } else if (isDefiSaverAutomatedTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Automated via${hyperlink(url, 'defisaver.com')} 🛟`;
  }

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
${healthAndDefiSaverLine}
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
  `;
}

export async function buildBorrowMessage(
  formattedEventData: any,
  isDefiSaverAutomatedTx: boolean,
  isManualSmartWalletTx: boolean,
  defiSaverUser: string
) {
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
    didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(
      COLLATERAL_URL,
      collateralName
    )}${dollarAddonCollat} and borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, 'crvUSD')}`;
  } else if (collateral_increase > 0) {
    didWhat = `increased collat by ${formatForPrint(collateral_increase)}${hyperlink(
      COLLATERAL_URL,
      collateralName
    )}${dollarAddonCollat}`;
  } else if (loan_increase >= 0) {
    if (loan_increase < MIN_REPAYED_AMOUNT_WORTH_PRINTING) return "don't print tiny liquidations";
    didWhat = `borrowed ${formatForPrint(loan_increase)}${hyperlink(crvUSD_URL, 'crvUSD')}`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  if (borrowerHealth !== 'no loan') borrowerHealth = formatForPrint(borrowerHealth * 100);

  let healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}`;
  if (isManualSmartWalletTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Manually via${hyperlink(url, 'defisaver.com')} 🛟`;
  } else if (isDefiSaverAutomatedTx) {
    const url = generateDefiSaverUrl(defiSaverUser, collateralName);
    healthAndDefiSaverLine = `Health of Borrower: ${borrowerHealth}
Automated via${hyperlink(url, 'defisaver.com')} 🛟`;
  }

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${didWhat}
${healthAndDefiSaverLine}
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
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

  if (borrowerHealth !== 'no loan') borrowerHealth = formatForPrint(borrowerHealth * 100);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} deposited ${borrowedAmount}${hyperlink(COLLATERAL_URL, collateralName)}
Health of Borrower: ${borrowerHealth}
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
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

  const shortenBuyer = 'Swap Router';

  soldAmount = formatForPrint(soldAmount);
  boughtAmount = formatForPrint(boughtAmount);
  dollarAmount = formatForPrint(dollarAmount);

  var dollarAddon = getDollarAddOn(dollarAmount);

  crvUSDinCirculation = formatForPrint(crvUSDinCirculation);

  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  let swappedWhat;
  if (tokenSoldName === 'crvUSD') {
    swappedWhat = `traded ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)} for ${soldAmount}${hyperlink(
      tokenInURL,
      tokenSoldName
    )}${dollarAddon}`;
  } else if (tokenSoldName === collateralName) {
    swappedWhat = `traded ${soldAmount}${hyperlink(
      tokenInURL,
      tokenSoldName
    )}${dollarAddon} for ${boughtAmount}${hyperlink(tokenOutURL, tokenBoughtName)}`;
  }

  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
1 ${collateralName} ➛ ${formatForPrint(collateral_price)} Dollar | ${formatForPrint(numberOfcrvUSDper1_collat)} crvUSD
Borrow APY: ${formatForPrint(borrowRate)}%
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
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
  if (tokenSoldName === 'crvUSD') {
    swappedWhat = `soft-liquidated ${boughtAmount}${hyperlink(
      tokenOutURL,
      tokenBoughtName
    )} with ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)}${dollarAddon}`;
  } else if (tokenSoldName === collateralName) {
    swappedWhat = `de-liquidated ${soldAmount}${hyperlink(tokenInURL, tokenSoldName)} with ${boughtAmount}${hyperlink(
      tokenOutURL,
      tokenBoughtName
    )}${dollarAddon}`;
  }

  let profitPrint = getProfitPrint(profit, revenue, cost);
  if (shortenBuyer === '1Inch') {
    let _1Inchdetails = await getSwap1InchMinAmountInfo(txHash);
    profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${
      _1Inchdetails.tokenInName
    } to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${_1Inchdetails.tokenOutName}`;
  } else if (shortenBuyer === '1inch v5: Aggregation Router') {
    let _1Inchdetails = await get1InchV5MinAmountInfo(txHash);
    profitPrint = `Decoded 1Inch-Swap: Swap ${formatForPrint(_1Inchdetails.amountIn)} ${
      _1Inchdetails.tokenInName
    } to min. ${formatForPrint(_1Inchdetails.minReturnAmount)} ${_1Inchdetails.tokenOutName}`;
  }
  let marketHealthPrint = getMarketHealthPrint(qtyCollat, collateralName, collatValue, marketBorrowedAmount);

  return `
  🚀${hyperlink(buyerURL, shortenBuyer)} ${swappedWhat}
${profitPrint}
${marketHealthPrint}
Marketcap: ${getShortenNumber(formatForPrint(marketCap))}  | Total borrowed: ${getShortenNumber(
    formatForPrint(crvUSDinCirculation)
  )} | Price: ${crvUSD_price.toFixed(4)}  
Links:${hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io')} |${hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io')} 🦙🦙🦙
`;
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
/////////////////// PEG-KEEPER /////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

export type PegKeeperMessageContext = {
  event: 'Provide' | 'Withdraw'; // Assuming these are the only two event types
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

export function buildPegKeeperMessage(
  pegKeeperDetails: PegKeeperDetail[],
  context: PegKeeperMessageContext,
  txHash: string
): string {
  let messageParts: string[] = [];
  let totalBefore = 0;
  let totalAfter = 0;

  const crvUSD_URL = getTokenURL(ADDRESS_crvUSD);
  const crvUSD_Link = hyperlink(crvUSD_URL, 'crvUSD');

  // Find the first peg keeper with a change in debt
  const significantPegKeeper = pegKeeperDetails.find(
    (detail) =>
      detail.debtAtBlock !== null &&
      detail.debtAtPreviousBlock !== null &&
      detail.debtAtBlock !== detail.debtAtPreviousBlock
  );

  // Generate a URL for the significant peg keeper, default to "#" if not found
  const pegkeeperURL = significantPegKeeper ? getPoolURL(significantPegKeeper.address) : '#';
  // Use the coin symbol of the significant peg keeper for the action line, default to "Pegkeeper/crvUSD" if not found
  const actionLineCoinSymbol = significantPegKeeper?.coinSymbol
    ? `${significantPegKeeper.coinSymbol}/crvUSD`
    : 'Pegkeeper/crvUSD';

  // Formatting the first line based on the event type
  const action = context.event === 'Provide' ? 'buffered' : 'released';
  const formattedAmount = getShortenNumberFixed(context.amount);

  // Constructing the summary line with hyperlink
  const summaryLine = `🛡 Pegkeeper${hyperlink(
    pegkeeperURL,
    actionLineCoinSymbol
  )} ${action} ${formattedAmount}${crvUSD_Link}\n`;

  messageParts.push(summaryLine);

  pegKeeperDetails.sort((a, b) => (a.coinSymbol || '').localeCompare(b.coinSymbol || ''));

  for (const detail of pegKeeperDetails) {
    if (detail.coinSymbol && detail.debtAtBlock !== null && detail.debtAtPreviousBlock !== null) {
      const beforeDebt = detail.debtAtPreviousBlock;
      const afterDebt = detail.debtAtBlock;
      totalBefore += Number(detail.debtAtPreviousBlock);
      totalAfter += Number(detail.debtAtBlock);

      // Generate URL for each peg keeper detail
      const detailURL = getPoolURL(detail.address);
      let debtChangeMessage = `${hyperlink(detailURL, `${detail.coinSymbol}/crvUSD`)} ${getShortenNumberFixed(
        beforeDebt
      )}`;
      if (detail.debtAtPreviousBlock !== detail.debtAtBlock) {
        debtChangeMessage += ` ➠ ${getShortenNumberFixed(afterDebt)}`;
      }

      messageParts.push(debtChangeMessage);
    }
  }

  const totalMessage = `\nTotal buffered: ${getShortenNumberFixed(totalBefore)} ➠ ${getShortenNumberFixed(
    totalAfter
  )}${crvUSD_Link}`;
  messageParts.push(totalMessage);

  const txHashURLfromEtherscan = getTxHashURLfromEtherscan(txHash);
  const txHashLinkEtherscan = hyperlink(txHashURLfromEtherscan, 'etherscan.io');
  const txHashURLfromEigenPhi = getTxHashURLfromEigenPhi(txHash);
  const txHashLinkEigenphi = hyperlink(txHashURLfromEigenPhi, 'eigenphi.io');
  const links = `Links:${txHashLinkEtherscan} |${txHashLinkEigenphi} 🦙🦙🦙`;
  messageParts.push(links);

  return messageParts.join('\n');
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
  market: EnrichedLendingMarketEvent,
  txHash: string,
  dollarAmount: number,
  agentAddress: string,
  parsedDepositedBorrowTokenAmount: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  totalDebtInMarket: number,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const vaultURL = getPoolURL(market.vault);

  const asset_URL = getTokenURL(market.borrowed_token);
  const asset_Link = hyperlink(asset_URL, market.borrowed_token_symbol);

  const dollarAddon = getDollarAddOn(dollarAmount);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
🚀${hyperlink(agentURL, shortenAgent)} deposited ${formatForPrint(
    parsedDepositedBorrowTokenAmount
  )}${asset_Link}${dollarAddon}
Market:${hyperlink(vaultURL, market.market_name)}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildLendingMarketWithdrawMessage(
  market: EnrichedLendingMarketEvent,
  txHash: string,
  dollarAmount: number,
  agentAddress: string,
  parsedWithdrawnBorrowTokenAmount: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  totalDebtInMarket: number,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const vaultURL = getPoolURL(market.vault);

  const asset_URL = getTokenURL(market.borrowed_token);
  const asset_Link = hyperlink(asset_URL, market.borrowed_token_symbol);

  const dollarAddon = getDollarAddOn(dollarAmount);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
User${hyperlink(agentURL, shortenAgent)} removed ${formatForPrint(
    parsedWithdrawnBorrowTokenAmount
  )}${asset_Link}${dollarAddon}
Market:${hyperlink(vaultURL, market.market_name)}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

// CONTROLLER-MESSAGES

export function buildLendingMarketBorrowMessage(
  market: EnrichedLendingMarketEvent,
  txHash: string,
  agentAddress: string,
  parsedBorrowedAmount: number,
  parsedCollatAmount: number,
  positionHealth: number,
  totalDebtInMarket: number,
  collatDollarAmount: number,
  dollarAmountBorrow: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);
  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  const vaultURL = getPoolURL(market.vault);

  const dollarAddon = getDollarAddOn(collatDollarAmount);
  const dollarAddonBorrow = getDollarAddOn(dollarAmountBorrow);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let userLine;
  if (collatDollarAmount < 1) {
    userLine = `🚀${hyperlink(agentURL, shortenAgent)} borrowed ${formatForPrint(
      parsedBorrowedAmount
    )}${borrowedTokenLink}${dollarAddonBorrow}`;
  } else if (dollarAmountBorrow < 1) {
    userLine = `🚀${hyperlink(agentURL, shortenAgent)} deposited ${formatForPrint(
      parsedCollatAmount
    )}${collat_Link}${dollarAddon}`;
  } else {
    userLine = `🚀${hyperlink(agentURL, shortenAgent)} deposited ${formatForPrint(
      parsedCollatAmount
    )}${collat_Link}${dollarAddon} and borrowed ${formatForPrint(
      parsedBorrowedAmount
    )}${borrowedTokenLink}${dollarAddonBorrow}`;
  }

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
${userLine}
Market:${hyperlink(vaultURL, market.market_name)}
${positionHealthLine}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildLendingMarketRepayMessage(
  market: EnrichedLendingMarketEvent,
  txHash: string,
  positionHealth: number,
  totalDebtInMarket: number,
  agentAddress: string,
  parsedRepayAmount: number,
  collatDollarAmount: number,
  parsedCollatAmount: number,
  repayDollarAmount: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(market.vault);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  const collatDollarAddon = getDollarAddOn(collatDollarAmount);
  const repayDollarAddon = getDollarAddOn(repayDollarAmount);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  let userLine;
  if (parsedCollatAmount > 1) {
    userLine = `User${hyperlink(agentURL, shortenAgent)} returned ${Number(
      parsedRepayAmount.toFixed(0)
    ).toLocaleString()}${borrowedTokenLink}${repayDollarAddon} and received ${Number(
      parsedCollatAmount.toFixed(0)
    ).toLocaleString()}${collat_Link}${collatDollarAddon}`;
  } else {
    userLine = `User${hyperlink(agentURL, shortenAgent)} returned ${Number(
      parsedRepayAmount.toFixed(0)
    ).toLocaleString()}${borrowedTokenLink}${repayDollarAddon}`;
  }

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
${userLine}
Market:${hyperlink(vaultURL, market.market_name)}
${positionHealthLine}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildLendingMarketRemoveCollateralMessage(
  market: EnrichedLendingMarketEvent,
  parsedCollatAmount: number,
  txHash: string,
  agentAddress: string,
  positionHealth: number,
  collatDollarAmount: number,
  totalDebtInMarket: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(market.vault);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const positionHealthLine = getLlamaLendPositionHealthLine(positionHealth);

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  const collatDollarAddOn = getDollarAddOn(collatDollarAmount);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
User${hyperlink(agentURL, shortenAgent)} removed ${formatForPrint(parsedCollatAmount)}${collat_Link}${collatDollarAddOn}
${positionHealthLine}
Market:${hyperlink(vaultURL, market.market_name)}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildLendingMarketSelfLiquidateMessage(
  market: EnrichedLendingMarketEvent,
  parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation: number,
  borrowTokenDollarAmount: number,
  parsedCollatAmount: number,
  collarDollarValue: number,
  txHash: string,
  totalDebtInMarket: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  liquidatorAddress: string,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(market.vault);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const liquidatorURL = getBuyerURL(liquidatorAddress);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
User${hyperlink(liquidatorURL, shortenAddress(liquidatorAddress))} self-liquidated ${formatForPrint(
    parsedCollatAmount
  )}${collat_Link} ($${Number(collarDollarValue.toFixed(0)).toLocaleString()}) with ${formatForPrint(
    parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation
  )}${borrowedTokenLink} ($${formatForPrint(borrowTokenDollarAmount)})
Market:${hyperlink(vaultURL, market.market_name)}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildLendingMarketHardLiquidateMessage(
  market: EnrichedLendingMarketEvent,
  parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation: number,
  borrowTokenDollarAmount: number,
  parsedCollatAmount: number,
  collarDollarValue: number,
  txHash: string,
  totalDebtInMarket: number,
  borrowApr: number,
  lendApr: number,
  totalAssets: number,
  liquidatorAddress: string,
  poorFellaAddress: string,
  gaugeBoostPercentage: number | null
): string {
  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const vaultURL = getPoolURL(market.vault);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const liquidatorURL = getBuyerURL(liquidatorAddress);
  const poorFellaURL = getBuyerURL(poorFellaAddress);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  const discountAmount = Math.abs(collarDollarValue - borrowTokenDollarAmount);

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
User${hyperlink(liquidatorURL, shortenAddress(liquidatorAddress))} hard-liquidated ${formatForPrint(
    parsedCollatAmount
  )}${collat_Link} ($${Number(collarDollarValue.toFixed(0)).toLocaleString()}) with ${formatForPrint(
    parsedBorrowTokenAmountSentByBotFromReceiptForHardLiquidation
  )}${borrowedTokenLink} ($${formatForPrint(borrowTokenDollarAmount)})
Market:${hyperlink(vaultURL, market.market_name)}
Discount: $${formatForPrint(discountAmount)}
Affected User:${hyperlink(poorFellaURL, shortenAddress(poorFellaAddress))}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
`;
}

export function buildSoftLiquidateMessage(
  market: EnrichedLendingMarketEvent,
  txHash: string,
  agentAddress: string,
  parsedSoftLiquidatedAmount: number,
  collatDollarAmount: number,
  parsedRepaidAmount: number,
  repaidBorrrowTokenDollarAmount: number,
  borrowApr: number,
  lendApr: number,
  totalDebtInMarket: number,
  totalAssets: number,
  gaugeBoostPercentage: number | null,
  discountAmount: number
): string {
  const vaultURL = getPoolURL(market.vault);

  const TX_HASH_URL_ETHERSCAN = getTxHashURLfromEtherscan(txHash);
  const TX_HASH_URL_EIGENPHI = getTxHashURLfromEigenPhi(txHash);

  const agentURL = getBuyerURL(agentAddress);
  const shortenAgent = getAddressName(agentAddress);

  const collat_URL = getTokenURL(market.collateral_token);
  const collat_Link = hyperlink(collat_URL, market.collateral_token_symbol);

  const borrowedTokenURL = getTokenURL(market.borrowed_token);
  const borrowedTokenLink = hyperlink(borrowedTokenURL, market.borrowed_token_symbol);

  const curveLendingLink = hyperlink(getCurveLendingURL(market.id), 'lend.curve.fi');
  const etherscanLink = hyperlink(TX_HASH_URL_ETHERSCAN, 'etherscan.io');
  const eigenphiLink = hyperlink(TX_HASH_URL_EIGENPHI, 'eigenphi.io');

  let direction;
  if (collatDollarAmount > repaidBorrrowTokenDollarAmount) {
    direction = 'soft';
  } else {
    direction = 'de';
  }

  let apyLine = `Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Borrow APY: ${calculateAPYFromAPR(
    borrowApr
  ).toFixed(2)}%`;
  if (gaugeBoostPercentage) {
    apyLine = `Base Lending APY: ${calculateAPYFromAPR(lendApr).toFixed(2)}% | Gauge: ${gaugeBoostPercentage.toFixed(
      2
    )}% | added: ${(calculateAPYFromAPR(lendApr) + gaugeBoostPercentage).toFixed(
      2
    )}% | Borrow APY: ${calculateAPYFromAPR(borrowApr).toFixed(2)}%`;
  }

  const utililizationRate = (totalDebtInMarket / totalAssets) * 100;

  return `
User${hyperlink(agentURL, shortenAgent)} ${direction}-liquidated ${formatForPrint(
    parsedSoftLiquidatedAmount
  )}${collat_Link} ($${Number(collatDollarAmount.toFixed(0)).toLocaleString()}) with ${formatForPrint(
    parsedRepaidAmount
  )}${borrowedTokenLink} ($${formatForPrint(repaidBorrrowTokenDollarAmount)})
Market:${hyperlink(vaultURL, market.market_name)}
Discount: $${formatForPrint(discountAmount)}
${apyLine}
Borrowed: ${getShortenNumberFixed(totalDebtInMarket)} out of ${getShortenNumberFixed(
    totalAssets
  )}${borrowedTokenLink} (${utililizationRate.toFixed(2)}%)
Links:${etherscanLink} |${eigenphiLink} |${curveLendingLink} 🦙🦙🦙
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
    const filePath = path.join(__dirname, '../../../lastSeen.json');
    const data = JSON.parse(await readFile(filePath, 'utf-8'));

    return {
      txHash: data.txHash,
      txTimestamp: new Date(data.txTimestamp),
    };
  } catch (error) {
    console.error('Error reading last seen data from file:', error);
    return null;
  }
}

function getTimeMessage(timestamp: Date): string {
  if (!timestamp) return 'never seen'; // If no transaction was seen

  const differenceInSeconds = (new Date().getTime() - timestamp.getTime()) / 1000;

  if (differenceInSeconds < 60) {
    const seconds = Math.floor(differenceInSeconds);
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} ago`;
  }
  if (differenceInSeconds < 3600) {
    const minutes = Math.floor(differenceInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  const hours = Math.floor(differenceInSeconds / 3600);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

function getLastSeenMessage(txHash: string, timestamp: Date) {
  const timeMessage = getTimeMessage(timestamp);
  const message = `The last seen crvUSD${hyperlink(getTxHashURLfromEtherscan(txHash), 'tx')} was ${timeMessage}`;
  return message;
}

let intervalId: NodeJS.Timeout | null = null;

async function getLastSeenMessageContent(): Promise<string> {
  const lastSeenValues = await getLastSeenValues();

  if (!lastSeenValues || !lastSeenValues.txHash) {
    return '¯⧵_(ツ)_/¯ ';
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
    bot.sendMessage(groupID, message, { parse_mode: 'HTML', disable_web_page_preview: 'true' });
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
  eventEmitter.emit('newMessage', message);
}

export function getTgBot(env: string) {
  let groupID: string | undefined;
  let telegramGroupToken: string | undefined;
  if (env == 'prod') {
    telegramGroupToken = process.env.TELEGRAM_CRVUSD_PROD_KEY!;
    groupID = process.env.TELEGRAM_PROD_GROUP_ID!;
  }
  if (env == 'test') {
    telegramGroupToken = process.env.TELEGRAM_CRVUSD_TEST_KEY!;
    groupID = process.env.TELEGRAM_TEST_GROUP_ID!;
  }

  const bot = new TelegramBot(telegramGroupToken!, { polling: true });
  return bot;
}

export async function telegramBotMain(env: string, bot: TelegramBot, eventEmitterTelegramBotRelated: EventEmitter) {
  let groupID: string | undefined;
  if (env == 'prod') {
    groupID = process.env.TELEGRAM_PROD_GROUP_ID!;
  }
  if (env == 'test') {
    groupID = process.env.TELEGRAM_TEST_GROUP_ID!;
  }

  eventEmitterTelegramBotRelated.on('newMessage', (message: string) => {
    if (groupID) {
      send(bot, message, parseInt(groupID));
    }
  });

  botMonitoringIntervalPrint(bot);

  bot.on('message', async (msg) => {
    if (msg.text === 'bot u with us') {
      await new Promise((resolve) => setTimeout(resolve, 650));
      if (groupID) {
        bot.sendMessage(msg.chat.id, 'always have been');
      }
    }
    if (msg && msg.text && msg.text.toLowerCase() === 'print last seen') {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await processLastSeen(eventEmitterTelegramBotRelated);
    }
  });
}
