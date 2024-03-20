import { getWeb3HttpProvider } from "./Web3.js";
import { getPastEvents, getWalletTokenBalance, web3Call } from "../web3Calls/generic.js";
import { solveProfit } from "../profit/profit.js";
import { getBorrowRateForProvidedLlamma } from "./LLAMMA.js";
import { getDecimalFromCheatSheet, getSymbolFromCheatSheet } from "../CollatCheatSheet.js";
import { AbiItem } from "web3-utils";
import { getPriceOf_crvUSD } from "../priceAPI/priceAPI.js";
import { getDollarValue } from "../../txValue/DefiLlama.js";
import { ADDRESS_crvUSD, ADDRESS_crvUSD_ControllerFactory, NULL_ADDRESS, addressAggMonetary } from "../Constants.js";
import { ABI_AggMonetaryPolicy } from "../abis/ABI_AggMonetaryPolicy.js";
import { ABI_Controller } from "../abis/ABI_Controller.js";
import { ABI_crvUSD_ControllerFactory } from "../abis/ABI_crvUSD_ControllerFactory.js";
import { ABI_crvUSD } from "../abis/ABI_crvUSD.js";

export function hasUndefinedOrNaNValues(data: Record<string, any>): boolean {
  return Object.values(data).some((value) => value === undefined || Number.isNaN(value));
}

async function getCollatPrice(controllerAddress: string, collateralAddress: string, blockNumber: number): Promise<number> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Controller, controllerAddress);

  const PRICE = await web3Call(CONTROLLER, "amm_price", [], blockNumber);
  // const COLLAT_DECIMALS = getDecimalFromCheatSheet(collateralAddress);
  return Number(PRICE / 10 ** 18);
}

async function getPositionHealthOfGeneralAddress(controllerAddress: string, userAddress: string, blockNumber: number): Promise<number | string | null> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Controller, controllerAddress);

  try {
    const hasLoan = await web3Call(CONTROLLER, "loan_exists", [userAddress], blockNumber);
    if (!hasLoan) return "no loan";

    const HEALTH = await web3Call(CONTROLLER, "health", [userAddress, "true"], blockNumber);
    return Number(HEALTH / 1e18);
  } catch (err) {
    return "no loan";
  }
}

async function getPositionHealth(controllerAddress: string, userAddress: string, blockNumber: number): Promise<number | null> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Controller, controllerAddress);

  const HEALTH = await web3Call(CONTROLLER, "health", [userAddress], blockNumber);
  return Number(HEALTH / 1e18);
}

async function getBorrowRate(event: any, AMM_ADDRESS: string): Promise<number | null> {
  const RATE = await getBorrowRateForProvidedLlamma(AMM_ADDRESS, event.blockNumber);
  return RATE;
}

async function getAmountOfCollatInMarket(addressCollat: string, addressAmm: string, blockNumber: number) {
  const BALANCE = await getWalletTokenBalance(addressAmm, addressCollat, blockNumber);
  const DECIMALS = getDecimalFromCheatSheet(addressCollat);
  return BALANCE / 10 ** DECIMALS;
}

async function getcrvUSDinCirculation(blockNumber: number): Promise<number> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
  const crvUSD_ControllerFactory = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD_ControllerFactory, ADDRESS_crvUSD_ControllerFactory);

  const totalDebt = await web3Call(crvUSD_ControllerFactory, "total_debt", [], blockNumber);
  return Number(totalDebt / 1e18);
}

async function getTotalMarketDebt(blockNumber: number, controllerAddress: string) {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_Controller, controllerAddress);

  const TOTAL_DEBT = await web3Call(CONTROLLER, "total_debt", [], blockNumber);
  return Number(TOTAL_DEBT / 1e18);
}

async function getCrvUsdTranserAmount(event: any) {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const crvUSD = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD, ADDRESS_crvUSD);

  let amounts = await getPastEvents(crvUSD, "Transfer", event.blockNumber, event.blockNumber);
  if (!amounts || !Array.isArray(amounts)) return;
  let amountElement = amounts.find(
    (element: any) => element.returnValues.sender === event.returnValues.liquidator || element.returnValues.receiver === event.returnValues.liquidator
  );

  let liquidatorCrvUsdTransferAmount = amountElement ? (amountElement as any).returnValues.value : "bar";
  return Number(liquidatorCrvUsdTransferAmount / 1e18);
}

async function getPegKeepers(blockNumber: number) {
  let web3 = getWeb3HttpProvider();

  const AggMonetaryPolicy = new web3.eth.Contract(ABI_AggMonetaryPolicy, addressAggMonetary);

  const pegKeeperAddresses = [];
  let index = 0;

  while (true) {
    try {
      const pegKeeperAddress = await web3Call(AggMonetaryPolicy, "peg_keepers", [index], blockNumber);
      if (pegKeeperAddress === NULL_ADDRESS) break;
      pegKeeperAddresses.push(pegKeeperAddress);
      index++;
    } catch (error) {
      break;
    }
  }

  return pegKeeperAddresses;
}

async function getMarketCap(blockNumber: number) {
  let web3 = getWeb3HttpProvider();
  const pegKeepers = await getPegKeepers(blockNumber);
  const ABI: AbiItem[] = [
    {
      stateMutability: "view",
      type: "function",
      name: "debt",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "uint256",
        },
      ],
    } as AbiItem,
  ];

  let pegKeepersDebt = 0;

  for (const pegKeeperAddress of pegKeepers) {
    const CONTRACT = new web3.eth.Contract(ABI, pegKeeperAddress);
    const debt = await web3Call(CONTRACT, "debt", [], blockNumber);
    pegKeepersDebt += debt / 1e18;
  }
  return pegKeepersDebt;
}

export async function processLiquidateEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  // during histo-mode, and a provided hard-liquidation, this chunk will create an excel with user health over time
  /*
  const healthResults = [];
  const steps = 100;

  for (let i = 0; i <= steps; i++) {
    const blockNumber = Number(event.blockNumber) - i;
    let userHealth = await getPositionHealthOfGeneralAddress(controllerAddress, event.returnValues.user, blockNumber);

    if (userHealth === "no loan") {
      userHealth = 0;
    }

    healthResults.push({
      blockDifference: i,
      health: userHealth,
    });

    console.log(`userHealth ${blockNumber}`, Number(Number(userHealth!).toFixed(6)));
  }

  function saveToExcel(results: any) {
    // Reverse the results array
    const reversedResults = [...results].reverse();

    const ws = XLSX.utils.json_to_sheet(reversedResults);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "HealthResults");

    XLSX.writeFile(wb, "healthResults.xlsx");
  }

  // After your loop completes:
  saveToExcel(healthResults);
  */

  let txHash = event.transactionHash;
  let liquidator = event.returnValues.liquidator;
  let user = event.returnValues.user;
  let stablecoin_received = event.returnValues.stablecoin_received;
  stablecoin_received /= 1e18;
  let debt = event.returnValues.debt;
  debt /= 1e18;
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
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);
  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);
  const botRevenue = dollarAmount - (debt - stablecoin_received);
  return {
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
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);
  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const borrowerHealth = await getPositionHealthOfGeneralAddress(controllerAddress, buyer, event.blockNumber);
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);
  return {
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
  };
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
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);
  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const borrowerHealth = await getPositionHealthOfGeneralAddress(controllerAddress, buyer, event.blockNumber);
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);
  return {
    crvUSD_price,
    borrowerHealth,
    marketCap,
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
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);
  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const borrowerHealth = await getPositionHealthOfGeneralAddress(controllerAddress, buyer, event.blockNumber);
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);
  return {
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
  };
}

export async function processBorrowEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let collateral_increase = event.returnValues.collateral_increase;
  let collateralDecimals = getDecimalFromCheatSheet(collateralAddress);
  collateral_increase /= 10 ** collateralDecimals;
  collateral_increase = Number(collateral_increase);
  let collateral_increase_value = await getDollarValue(collateralAddress, collateral_increase);
  let loan_increase = event.returnValues.loan_increase;
  loan_increase /= 1e18;
  loan_increase = Number(loan_increase);
  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);
  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collateral_price = await getCollatPrice(controllerAddress, collateralAddress, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);
  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const borrowerHealth = await getPositionHealthOfGeneralAddress(controllerAddress, buyer, event.blockNumber);
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);

  return {
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
  };
}

export async function processTokenExchangeEvent(event: any, controllerAddress: string, collateralAddress: string, AMM_ADDRESS: string) {
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

  let borrowRate = await getBorrowRate(event, AMM_ADDRESS);
  let collateralName = getSymbolFromCheatSheet(collateralAddress);

  let qtyCollat = await getAmountOfCollatInMarket(collateralAddress, AMM_ADDRESS, event.blockNumber);
  let collatValue = qtyCollat * collateral_price;
  let marketBorrowedAmount = await getTotalMarketDebt(event.blockNumber, controllerAddress);
  let crvUSDinCirculation = await getcrvUSDinCirculation(event.blockNumber);

  const marketCap = crvUSDinCirculation + (await getMarketCap(event.blockNumber));
  const crvUSD_price = await getPriceOf_crvUSD(event.blockNumber);

  return {
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
  };
}
