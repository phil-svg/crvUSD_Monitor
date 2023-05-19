import axios from "axios";
import fs from "fs";
import { getWeb3HttpProvider } from "./Web3.js";
import { getPastEvents } from "../web3Calls/generic.js";
import { solveProfit } from "../profit/profit.js";

async function getTokenPrice(tokenAddress: string) {
  const maxAttempts = 5;
  const delay = 350;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`);
      const data = response.data[tokenAddress.toLowerCase()];
      if (!data) return undefined;
      const price = data.usd;
      return price;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(`Failed to fetch token price after ${maxAttempts} attempts.`, error);
        break;
      }
      console.warn(`Attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function getTotalDebt(blockNumber: number) {
  const ADDRESS_CONTROLLER = "0x8472A9A7632b173c8Cf3a86D3afec50c35548e76";
  const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
  const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);

  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_CONTROLLER, ADDRESS_CONTROLLER);

  const TOTAL_DEBT = await CONTROLLER.methods.total_debt().call(blockNumber);
  return Number(TOTAL_DEBT / 1e18);
}

async function getCrvUsdTranserAmount(event: any) {
  const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
  const ABI_crvUSD_RAW = fs.readFileSync("../JSONs/crvUSDAbi.json", "utf8");
  const ABI_crvUSD = JSON.parse(ABI_crvUSD_RAW);

  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const crvUSD = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_crvUSD, ADDRESS_crvUSD);

  let amounts = await getPastEvents(crvUSD, "Transfer", event.blockNumber, event.blockNumber);
  if (!amounts || !Array.isArray(amounts)) return;
  let amountElement = amounts.find((element: any) => element.returnValues.sender === event.returnValues.liquidator);
  let liquidatorCrvUsdTransferAmount = amountElement ? (amountElement as any).returnValues.value : "bar";
  return Number(liquidatorCrvUsdTransferAmount / 1e18);
}

export async function processLiquidateEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let liquidator = event.returnValues.liquidator;
  let user = event.returnValues.user;
  let stablecoin_received = event.returnValues.stablecoin_received;
  stablecoin_received /= 1e18;
  let collateral_received = event.returnValues.collateral_received;
  collateral_received /= 1e18;
  let crvUSD_amount = await getCrvUsdTranserAmount(event);
  let price_sfrxETH = await getTokenPrice("0xac3E018457B222d93114458476f3E3416Abbe38F");
  let dollarAmount = Number(collateral_received * price_sfrxETH);
  return { dollarAmount, liquidator, crvUSD_amount, user, stablecoin_received, collateral_received, txHash, crvUSDinCirculation };
}

export async function processRemoveCollateralEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let withdrawnAmountcrvUSD = event.returnValues.amount_borrowed;
  withdrawnAmountcrvUSD /= 1e18;
  let collateral_decrease = event.returnValues.collateral_decrease;
  collateral_decrease /= 1e18;
  let price_sfrxETH = await getTokenPrice("0xac3E018457B222d93114458476f3E3416Abbe38F");
  let dollarAmount = Number(collateral_decrease * price_sfrxETH);
  return { dollarAmount, collateral_decrease, txHash, buyer, crvUSDinCirculation };
}

export async function processWithdrawEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let buyer = event.returnValues.provider;
  let withdrawnAmountcrvUSD = event.returnValues.amount_borrowed;
  withdrawnAmountcrvUSD /= 1e18;
  let withdrawnAmountsfrxETH = event.returnValues.amount_collateral;
  withdrawnAmountsfrxETH /= 1e18;
  return { withdrawnAmountcrvUSD, withdrawnAmountsfrxETH, txHash, buyer, crvUSDinCirculation };
}

export async function processDepositEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let buyer = event.returnValues.provider;
  let borrowedAmount = event.returnValues.amount;
  borrowedAmount /= 1e18;
  return { borrowedAmount, txHash, buyer, crvUSDinCirculation };
}

export async function processRepayEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let collateral_decrease = event.returnValues.collateral_decrease;
  collateral_decrease /= 1e18;
  collateral_decrease = Number(collateral_decrease);
  let loan_decrease = event.returnValues.loan_decrease;
  loan_decrease /= 1e18;
  loan_decrease = Number(loan_decrease);
  return { collateral_decrease, loan_decrease, txHash, buyer, crvUSDinCirculation };
}

export async function processBorrowEvent(event: any) {
  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  let txHash = event.transactionHash;
  let buyer = event.returnValues.user;
  let collateral_increase = event.returnValues.collateral_increase;
  collateral_increase /= 1e18;
  collateral_increase = Number(collateral_increase);
  let loan_increase = event.returnValues.loan_increase;
  loan_increase /= 1e18;
  loan_increase = Number(loan_increase);
  return { collateral_increase, loan_increase, txHash, buyer, crvUSDinCirculation };
}

export async function processTokenExchangeEvent(event: any) {
  const ADDRESS_crvUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E";
  const ADDRESS_sfrxETH = "0xac3E018457B222d93114458476f3E3416Abbe38F";

  let txHash = event.transactionHash;
  let buyer = event.returnValues.buyer;

  let soldAmount = event.returnValues.tokens_sold;
  Number((soldAmount /= 1e18));

  let boughtAmount = event.returnValues.tokens_bought;
  Number((boughtAmount /= 1e18));

  let price_sfrxETH = await getTokenPrice("0xac3E018457B222d93114458476f3E3416Abbe38F");

  let soldAddress;
  let boughtAddress;
  let tokenSoldName;
  let tokenBoughtName;
  let numberOfcrvUSDper1_sfrxETH;
  let amount_sfrxETH;
  let amount_crvUSD;
  if (event.returnValues.sold_id === "0") {
    soldAddress = ADDRESS_crvUSD;
    boughtAddress = ADDRESS_sfrxETH;
    tokenSoldName = "crvUSD";
    amount_crvUSD = soldAmount;
    tokenBoughtName = "sfrxETH";
    amount_sfrxETH = boughtAmount;
    numberOfcrvUSDper1_sfrxETH = soldAmount / boughtAmount;
  }
  if (event.returnValues.sold_id === "1") {
    boughtAddress = ADDRESS_crvUSD;
    soldAddress = ADDRESS_sfrxETH;
    tokenSoldName = "sfrxETH";
    amount_sfrxETH = soldAmount;
    tokenBoughtName = "crvUSD";
    amount_crvUSD = boughtAmount;
    numberOfcrvUSDper1_sfrxETH = boughtAmount / soldAmount;
  }

  let dollarAmount;
  if (event.returnValues.sold_id === "0") dollarAmount = Number(boughtAmount * price_sfrxETH);
  if (event.returnValues.sold_id === "1") dollarAmount = Number(soldAmount * price_sfrxETH);

  let crvUSDinCirculation = await getTotalDebt(event.blockNumber);
  if (!tokenSoldName) return;

  let [profit, revenue, cost] = (await solveProfit(event)) || [0, 0, 0];
  console.log("profit, revenue, cost", profit, revenue, cost);
  if (profit === 0 || revenue === 0 || cost === 0) return;

  return {
    numberOfcrvUSDper1_sfrxETH,
    price_sfrxETH,
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
  };
}
