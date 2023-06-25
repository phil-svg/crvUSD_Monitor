import { getRawTokens } from "./tokens.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import fs from "fs";
import { web3Call } from "../web3Calls/generic.js";
import { getDecimalFromCheatSheet } from "../CollatCheatSheet.js";

const rawTokens = getRawTokens();
const tokens: Record<string, string> = rawTokens;

async function getPriceOf_ETH(blockNumber: number): Promise<number | null> {
  let web3 = getWeb3HttpProvider();
  const ADDRESS_TRICRYPTO = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
  const ABI_TRICRYPTO_RAW = fs.readFileSync("../JSONs/TRICRYPTOAbi.json", "utf8");
  const ABI_TRICRYPTO = JSON.parse(ABI_TRICRYPTO_RAW);

  const TRICRYPTO = new web3.eth.Contract(ABI_TRICRYPTO, ADDRESS_TRICRYPTO);

  try {
    return (await TRICRYPTO.methods.price_oracle(1).call(blockNumber)) / 1e18;
  } catch (error) {
    return null;
  }
}

export async function getPriceOf_sfrxETH(blockNumber: number): Promise<number | null> {
  let web3 = getWeb3HttpProvider();
  const ADDRESS_PRICE_ORACLE = "0x19F5B81e5325F882C9853B5585f74f751DE3896d";
  const ABI_PRICE_ORACLE_RAW = fs.readFileSync("../JSONs/PRICE_ORACLEabi.json", "utf8");
  const ABI_PRICE_ORACLE = JSON.parse(ABI_PRICE_ORACLE_RAW);

  const PRICE_ORACLE = new web3.eth.Contract(ABI_PRICE_ORACLE, ADDRESS_PRICE_ORACLE);

  try {
    return (await PRICE_ORACLE.methods.price().call(blockNumber)) / 1e18;
  } catch (error) {
    return null;
  }
}

export async function getPriceOf_WETH(blockNumber: number): Promise<number | null> {
  return await getPriceOf_ETH(blockNumber);
}

export async function getPriceOf_frxETH(blockNumber: number): Promise<number | null> {
  return await getPriceOf_ETH(blockNumber);
}

export async function getPriceOf_crvUSD(blockNumber: number): Promise<number | null> {
  let web3 = getWeb3HttpProvider();
  const ADDRESS_PRICE_AGGREGATOR = "0xe5Afcf332a5457E8FafCD668BcE3dF953762Dfe7";
  const ABI_PRICE_AGGREGATOR_RAW = fs.readFileSync("../JSONs/PRICE_AGGREGATORAbi.json", "utf8");
  const ABI_PRICE_AGGREGATOR = JSON.parse(ABI_PRICE_AGGREGATOR_RAW);

  const PRICE_AGGREGATOR = new web3.eth.Contract(ABI_PRICE_AGGREGATOR, ADDRESS_PRICE_AGGREGATOR);

  try {
    return (await PRICE_AGGREGATOR.methods.price().call(blockNumber)) / 1e18;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getPriceOf_wstETH(blockNumber: number): Promise<number | null> {
  const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();

  const ABI_CONTROLLER_RAW = fs.readFileSync("../JSONs/ControllerAbi.json", "utf8");
  const ABI_CONTROLLER = JSON.parse(ABI_CONTROLLER_RAW);
  const CONTROLLER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_CONTROLLER, "0x100dAa78fC509Db39Ef7D04DE0c1ABD299f4C6CE");

  const PRICE = await web3Call(CONTROLLER, "amm_price", [], blockNumber);
  const COLLAT_DECIMALS = 18;

  try {
    return Number(PRICE / 10 ** COLLAT_DECIMALS);
  } catch (error) {
    return null;
  }
}

export async function getPriceOf_USDT(blockNumber: number): Promise<number | null> {
  return 1;
}

export async function getPriceOf_USDC(blockNumber: number): Promise<number | null> {
  return 1;
}

const tokenGetPriceFunctions: { [key: string]: (blockNumber: number) => Promise<number | null> } = {
  getPriceOf_ETH: getPriceOf_ETH,
  getPriceOf_WETH: getPriceOf_WETH,
  getPriceOf_frxETH: getPriceOf_frxETH,
  getPriceOf_crvUSD: getPriceOf_crvUSD,
  getPriceOf_USDT: getPriceOf_USDT,
  getPriceOf_USDC: getPriceOf_USDC,
  getPriceOf_sfrxETH: getPriceOf_sfrxETH,
  getPriceOf_wstETH: getPriceOf_wstETH,
};

const tokenPriceFunctions: { [key: string]: (blockNumber: number) => Promise<number | null> } = {};
Object.keys(tokens).forEach((tokenName) => {
  const functionName = `getPriceOf_${tokenName}`;
  if (tokenGetPriceFunctions[functionName]) {
    tokenPriceFunctions[functionName] = tokenGetPriceFunctions[functionName];
  }
});

export async function getPrice(address: string, blockNumber: number): Promise<number | null> {
  const lowercasedAddress = address.toLowerCase();
  let tokenName = Object.keys(tokens).find((key) => tokens[key].toLowerCase() === lowercasedAddress.toLowerCase());
  if (tokenName) {
    const functionName = `getPriceOf_${tokenName}`;
    return await tokenPriceFunctions[functionName](blockNumber);
  }
  console.log(`token ${address} not saved in priceAPI`);
  return null; // handle the case when the address is not found
}
