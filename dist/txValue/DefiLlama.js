import axios from "axios";
export async function getCurrentTokenPriceFromDefiLlama(token) {
    try {
        const url = `https://coins.llama.fi/prices/current/ethereum:${token}?searchWidth=4h`;
        const response = await axios.get(url);
        const fullTokenKey = `ethereum:${token}`;
        if (response.data.coins[fullTokenKey]) {
            return response.data.coins[fullTokenKey].price;
        }
        else {
            console.log(`No price data for token: ${token}`);
        }
    }
    catch (err) {
        console.log(`Failed to fetch price from DefiLlama for token: ${token}, error: ${err}`);
    }
    return null;
}
export async function getDollarValue(tokenAddress, tokenAmount) {
    const price = await getCurrentTokenPriceFromDefiLlama(tokenAddress);
    if (price) {
        return price * tokenAmount;
    }
    return null;
}
//# sourceMappingURL=DefiLlama.js.map