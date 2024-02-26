import { web3Call } from "../web3Calls/generic.js";
export async function getBorrowApr(vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, "borrow_apr", [], blockNumber);
    return res / 1e16;
}
export async function getLendApr(vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, "lend_apr", [], blockNumber);
    return res / 1e16;
}
export async function getTotalAssets(market, vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, "totalAssets", [], blockNumber);
    return res / 10 ** market.borrowed_token_decimals;
}
export async function getTotalDebtInMarket(market, controllerContact, blockNumber) {
    const res = await web3Call(controllerContact, "total_debt", [], blockNumber);
    return res / 10 ** market.borrowed_token_decimals;
}
export async function getPositionHealth(controllerContact, user, blockNumber) {
    const res = await web3Call(controllerContact, "health", [user], blockNumber);
    return res / 1e16;
}
export async function getCollatDollarValue(market, controllerContact, blockNumber) {
    const res = await web3Call(controllerContact, "amm_price", [], blockNumber);
    return res / 10 ** market.collateral_token_decimals;
}
//# sourceMappingURL=Lending.js.map