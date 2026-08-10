import { getTxReceiptClassic, web3Call } from '../web3/Web3Basics.js';
// OnlyBoost (StakeDAO) routes its lending flows through helper contracts, so
// the actor field in the event is never the OnlyBoost address itself. If the
// voter proxy shows up anywhere in the tx logs, display the actor as OnlyBoost.
const ONLY_BOOST_ADDRESS = '0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6';
export async function considerOnlyBoost(actorAddress, txHash) {
    try {
        const receipt = await getTxReceiptClassic(txHash);
        const needle = ONLY_BOOST_ADDRESS.slice(2).toLowerCase();
        if (receipt && JSON.stringify(receipt.logs).toLowerCase().includes(needle))
            return ONLY_BOOST_ADDRESS;
    }
    catch (_a) {
        // on any rpc hiccup keep the real actor
    }
    return actorAddress;
}
export async function getBorrowApr(vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, 'borrow_apr', [], blockNumber);
    return res / 1e16;
}
export async function getLendApr(vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, 'lend_apr', [], blockNumber);
    return res / 1e16;
}
export async function getTotalAssets(market, vaultContract, blockNumber) {
    const res = await web3Call(vaultContract, 'totalAssets', [], blockNumber);
    return res / 10 ** market.borrowed_token_decimals;
}
export async function getTotalDebtInMarket(market, controllerContact, blockNumber) {
    const res = await web3Call(controllerContact, 'total_debt', [], blockNumber);
    return res / 10 ** market.borrowed_token_decimals;
}
export async function getPositionHealth(controllerContact, user, blockNumber) {
    const res = await web3Call(controllerContact, 'health', [user], blockNumber);
    return res / 1e16;
}
export async function getCollatDollarValue(market, ammContract, blockNumber) {
    let res = await web3Call(ammContract, 'price_oracle', [], blockNumber);
    res = res / 1e18;
    const isLongPosition = market.market_name.endsWith('Long');
    if (isLongPosition)
        return res;
    return 1 / res;
}
//# sourceMappingURL=Lending.js.map