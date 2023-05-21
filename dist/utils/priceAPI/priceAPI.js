import { getRawTokens } from "./tokens.js";
import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import fs from "fs";
const rawTokens = getRawTokens();
const tokens = rawTokens;
async function getEthPrice(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_TRICRYPTO = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const ABI_TRICRYPTO_RAW = fs.readFileSync("../JSONs/TRICRYPTOAbi.json", "utf8");
    const ABI_TRICRYPTO = JSON.parse(ABI_TRICRYPTO_RAW);
    const TRICRYPTO = new web3.eth.Contract(ABI_TRICRYPTO, ADDRESS_TRICRYPTO);
    try {
        return (await TRICRYPTO.methods.price_oracle(1).call(blockNumber)) / 1e18;
    }
    catch (error) {
        return null;
    }
}
export async function getPriceOf_sfrxETH(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_PRICE_ORACLE = "0x19F5B81e5325F882C9853B5585f74f751DE3896d";
    const ABI_PRICE_ORACLE_RAW = fs.readFileSync("../JSONs/PRICE_ORACLEAbi.json", "utf8");
    const ABI_PRICE_ORACLE = JSON.parse(ABI_PRICE_ORACLE_RAW);
    const PRICE_ORACLE = new web3.eth.Contract(ABI_PRICE_ORACLE, ADDRESS_PRICE_ORACLE);
    try {
        return (await PRICE_ORACLE.methods.price().call(blockNumber)) / 1e18;
    }
    catch (error) {
        return null;
    }
}
export async function getPriceOf_WETH(blockNumber) {
    return await getEthPrice(blockNumber);
}
export async function getPriceOf_frxETH(blockNumber) {
    return await getEthPrice(blockNumber);
}
export async function getPriceOf_crvUSD(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_PRICE_AGGREGATOR = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const ABI_PRICE_AGGREGATOR_RAW = fs.readFileSync("../JSONs/PRICE_AGGREGATORAbi.json", "utf8");
    const ABI_PRICE_AGGREGATOR = JSON.parse(ABI_PRICE_AGGREGATOR_RAW);
    const PRICE_AGGREGATOR = new web3.eth.Contract(ABI_PRICE_AGGREGATOR, ADDRESS_PRICE_AGGREGATOR);
    try {
        return (await PRICE_AGGREGATOR.methods.price().call(blockNumber)) / 1e18;
    }
    catch (error) {
        return null;
    }
}
export async function getPriceOf_USDT(blockNumber) {
    return 1;
}
export async function getPriceOf_USDC(blockNumber) {
    return 1;
}
const tokenGetPriceFunctions = {
    getPriceOf_WETH: getPriceOf_WETH,
    getPriceOf_frxETH: getPriceOf_frxETH,
    getPriceOf_crvUSD: getPriceOf_crvUSD,
    getPriceOf_USDT: getPriceOf_USDT,
    getPriceOf_USDC: getPriceOf_USDC,
    getPriceOf_sfrxETH: getPriceOf_sfrxETH,
};
const tokenPriceFunctions = {};
Object.keys(tokens).forEach((tokenName) => {
    const functionName = `getPriceOf_${tokenName}`;
    if (tokenGetPriceFunctions[functionName]) {
        tokenPriceFunctions[functionName] = tokenGetPriceFunctions[functionName];
    }
});
export async function getPrice(address, blockNumber) {
    const lowercasedAddress = address.toLowerCase();
    const tokenName = Object.keys(tokens).find((key) => tokens[key].toLowerCase() === lowercasedAddress.toLowerCase());
    if (tokenName) {
        const functionName = `getPriceOf_${tokenName}`;
        return tokenPriceFunctions[functionName](blockNumber);
    }
    console.log(`token ${address} not saved in priceAPI`);
    return null; // handle the case when the address is not found
}
//# sourceMappingURL=priceAPI.js.map