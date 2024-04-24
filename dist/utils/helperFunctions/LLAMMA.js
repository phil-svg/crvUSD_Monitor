import { ABI_AMM } from '../abis/ABI_AMM.js';
import { WEB3_HTTP_PROVIDER } from '../web3connections.js';
export function calculateInterest(rate) {
    rate = rate / 1e18;
    const SECONDS_IN_A_YEAR = 365 * 86400;
    const e = 2.718281828459;
    let percentageRate = (Math.pow(e, rate * SECONDS_IN_A_YEAR) - 1) * 100;
    return percentageRate;
}
export function calculateAPYFromAPR(apr) {
    const rateAsDecimal = apr / 100;
    const e = Math.E;
    let apy = (Math.pow(e, rateAsDecimal) - 1) * 100;
    return apy;
}
export async function getBorrowRateForProvidedLlamma(LLAMMA_ADDRESS, blockNumber) {
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
//# sourceMappingURL=LLAMMA.js.map