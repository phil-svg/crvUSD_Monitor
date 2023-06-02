import fs from "fs";
import { getWeb3HttpProvider } from "./Web3.js";
export function calculateInterest(rate) {
    rate = rate / 1e18;
    const SECONDS_IN_A_YEAR = 365 * 86400;
    const e = 2.718281828459;
    let percentageRate = (Math.pow(e, rate * SECONDS_IN_A_YEAR) - 1) * 100;
    return percentageRate;
}
export async function getBorrowRate(LLAMMA_ADDRESS, blockNumber) {
    const WEB3_HTTP_PROVIDER = getWeb3HttpProvider();
    const ABI_AMM_RAW = fs.readFileSync("../JSONs/AmmAbi.json", "utf8");
    const ABI_AMM = JSON.parse(ABI_AMM_RAW);
    const AMM = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_AMM, LLAMMA_ADDRESS);
    try {
        let rate = Number(await AMM.methods.rate().call(blockNumber));
        return calculateInterest(rate);
    }
    catch (err) {
        console.log(err);
        return null;
    }
}
//# sourceMappingURL=Rate.js.map