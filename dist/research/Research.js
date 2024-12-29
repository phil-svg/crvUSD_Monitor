import { checkTokenFlow } from './Flow.js';
export async function conductResearch() {
    console.log('conducting research...');
    // checks the price over couple blocks, and compares the prices of the two aggregators
    // await plotHistoPriceComparison();
    // screens what happens with minted crvUSD
    await checkTokenFlow();
}
//# sourceMappingURL=Research.js.map