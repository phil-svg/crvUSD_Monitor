import { plotHistoPriceComparison } from './crvUSD_Price.js';
import { checkTokenFlow } from './Flow.js';

export async function conductResearch(): Promise<void> {
  console.log('conducting research...');

  // checks the price over couple blocks, and compares the prices of the two aggregators
  // await plotHistoPriceComparison();

  // screens what happens with minted crvUSD
  await checkTokenFlow();
}
