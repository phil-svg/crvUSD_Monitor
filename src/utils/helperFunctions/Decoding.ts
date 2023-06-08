import fs from "fs";
import { getWeb3HttpProvider, getWeb3WsProvider } from "./Web3.js";
import { getPastEvents, getWalletTokenBalance, web3Call } from "../web3Calls/generic.js";
import { solveProfit } from "../profit/profit.js";
import { getBorrowRateForProvidedLlamma } from "./LLAMMA.js";
import { getDecimalFromCheatSheet, getSymbolFromCheatSheet } from "../CollatCheatSheet.js";

async function getCollatPrice(controllerAddress: string, collateralAddress: string, blockNumber: number): Promise<number> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
  const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_CONTROLLER, controllerAddress);

  const PRICE = await web3Call(CONTROLLER, "amm_price", [], blockNumber);
  const COLLAT_DECIMALS = getDecimalFromCheatSheet(collateralAddress);
  return Number(PRICE / 10 ** COLLAT_DECIMALS);
}

async function getPositionHealth(controllerAddress: string, userAddress: string, blockNumber: number): Promise<number | null> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
  const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_CONTROLLER, controllerAddress);

  const HEALTH = await web3Call(CONTROLLER, "health", [userAddress], blockNumber);
  return Number(HEALTH / 1e18);
}

async function getBorrowRate(event: any, AMM_ADDRESS: string): Promise<number | null> {
  const RATE = await getBorrowRateForProvidedLlamma(AMM_ADDRESS, event.blockNumber);
  if (!RATE) return null;
  return RATE;
}

async function getAmountOfCollatInMarket(addressCollat: string, addressAmm: string, blockNumber: number) {
  const BALANCE = await getWalletTokenBalance(addressAmm, addressCollat, blockNumber);
  const DECIMALS = getDecimalFromCheatSheet(addressCollat);
  return BALANCE / 10 ** DECIMALS;
}

async function getMarketCap(blockNumber: number): Promise<number> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
  const ADDRESS_crvUSD_ControllerFactory = "0xC9332fdCB1C491Dcc683bAe86Fe3cb70360738BC";
  const ABI_crvUSD_ControllerFactory = JSON.parse(fs.readFileSync("../JSONs/crvUSD_ControllerFactory.json", "utf8"));
  const crvUSD_ControllerFactory = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD_ControllerFactory, ADDRESS_crvUSD_ControllerFactory);

  const totalDebt = await web3Call(crvUSD_ControllerFactory, "total_debt", [], blockNumber);
  return Number(totalDebt / 1e18);
}

async function getTotalMarketDebt(blockNumber: number, controllerAddress: string) {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const ABI_CONTROLLER = JSON.parse(fs.readFileSync("../JSONs/ControllerAbi.json", "utf8"));
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_CONTROLLER, controllerAddress);

  const TOTAL_DEBT = await web3Call(CONTROLLER, "total_debt", [], blockNumber);
  return Number(TOTAL_DEBT / 1e18);
}

async function getCrvUsdTranserAmount(event: any) {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
  const ABI_crvUSD = JSON.parse(fs.readFileSync("../JSONs/crvUSDAbi.json", "utf8"));
  const crvUSD = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD, ADDRESS_crvUSD);

  let amounts = await getPastEvents(crvUSD, "Transfer", event.blockNumber, event.blockNumber);
  if (!amounts || !Array.isArray(amounts)) return;
  let amountElement = amounts.find((element: any) => element.returnValues.sender === event.returnValues.liquidator);
  let liquidatorCrvUsdTransferAmount = amountElement ? (amountElement as any).returnValues.value : "bar";
  return Number(liquidatorCrvUsdTransferAmount / 1e18);
}

export async function processLiquidateEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let liquidator = event.returnValues.liquidator;
  let user = event.returnValues.user;
  let stablecoin_received = event.returnValues.stablecoin_received;
  stablecoin_received /= 1e18;
  let collateral_received = event.returnValues.collateral_received;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_received /= 10 ** collateralDecimals;
  let crvUSD_amount = await getCrvUsdTranserAmount(event);
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let dollarAmount = Number(collateral_received * collateral_price!);
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);
  return {
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
  };
}

export async function processRemoveCollateralEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let withdrawnAmountcrvUSD = event.returnValues.amount_borrowed;
  withdrawnAmountcrvUSD /= 1e18;
  let collateral_decrease = event.returnValues.collateral_decrease;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_decrease /= 10 ** collateralDecimals;
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let dollarAmount = Number(collateral_decrease * collateral_price!);
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);
  return { qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, dollarAmount, collateral_decrease, txHash, buyer, crvUSDinCirculation, borrowRate };
}

export async function processWithdrawEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let buyer = event.returnValues.provider;
  let withdrawnAmountcrvUSD = event.returnValues.amount_borrowed;
  withdrawnAmountcrvUSD /= 1e18;
  let withdrawnAmountsCollat = event.returnValues.amount_collateral;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  withdrawnAmountsCollat /= 10 ** collateralDecimals;
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  if (!borrowRate) return null;
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);
  return {
    qtyCollat,
    collatValue,
    marketBorrowedAmount,
    collateralAddress,
    collateralName,
    withdrawnAmountcrvUSD,
    withdrawnAmountsCollat,
    txHash,
    buyer,
    crvUSDinCirculation,
    borrowRate,
  };
}

export async function processRepayEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let collateral_decrease = event.returnValues.collateral_decrease;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_decrease /= 10 ** collateralDecimals;
  collateral_decrease = Number(collateral_decrease);
  let loan_decrease = event.returnValues.loan_decrease;
  loan_decrease /= 1e18;
  loan_decrease = Number(loan_decrease);
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);
  return { qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_decrease, loan_decrease, txHash, buyer, crvUSDinCirculation, borrowRate };
}

export async function processBorrowEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let collateral_increase = event.returnValues.collateral_increase;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_increase /= 10 ** collateralDecimals;
  collateral_increase = Number(collateral_increase);
  let loan_increase = event.returnValues.loan_increase;
  loan_increase /= 1e18;
  loan_increase = Number(loan_increase);
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);
  return { qtyCollat, collatValue, marketBorrowedAmount, collateralAddress, collateralName, collateral_increase, loan_increase, txHash, buyer, crvUSDinCirculation, borrowRate };
}

export async function processTokenExchangeEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";

  let txHash = event.transactionHash;
  let buyer = event.returnValues.buyer;

  let soldAmount = event.returnValues.tokens_sold;

  let boughtAmount = event.returnValues.tokens_bought;

  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);

  let collatName = getSymbolFromCheatSheet(collateralAddress);
  let collatDecimals = getDecimalFromCheatSheet(collateralAddress);

  let soldAddress;
  let boughtAddress;
  let tokenSoldName;
  let tokenBoughtName;
  let numberOfcrvUSDper1_collat;
  let amount_collat;
  let amount_crvUSD;

  if (event.returnValues.sold_id === "0") {
    soldAddress = ADDRESS_crvUSD;
    boughtAddress = collateralAddress;
    tokenSoldName = "crvUSD";
    soldAmount = Number(soldAmount / 1e18);
    amount_crvUSD = soldAmount;
    tokenBoughtName = collatName;
    boughtAmount = Number(boughtAmount / 10 ** collatDecimals);
    amount_collat = boughtAmount;
    numberOfcrvUSDper1_collat = soldAmount / boughtAmount;
  }
  if (event.returnValues.sold_id === "1") {
    boughtAddress = ADDRESS_crvUSD;
    soldAddress = collateralAddress;
    tokenSoldName = collatName;
    soldAmount = Number(soldAmount / 10 ** collatDecimals);
    amount_collat = soldAmount;
    tokenBoughtName = "crvUSD";
    boughtAmount = Number(boughtAmount / 1e18);
    amount_crvUSD = boughtAmount;
    numberOfcrvUSDper1_collat = boughtAmount / soldAmount;
  }

  let dollarAmount;
  if (event.returnValues.sold_id === "0") dollarAmount = Number(boughtAmount * collateral_price!);
  if (event.returnValues.sold_id === "1") dollarAmount = Number(soldAmount * collateral_price!);

  if (!tokenSoldName) return;

  let [profit, revenue, cost] = (await solveProfit(event)) || [0, 0, 0];
  if (cost === 0) return;

  const MICH = "0x7a16fF8270133F063aAb6C9977183D9e72835428";
  let researchPositionHealth = await getPositionHealth(controllerAddress, MICH, event.blockNumber);

  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);

  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getMarketCap(event.blockNumber);

  return {
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
    researchPositionHealth,
    borrowRate,
  };
}
