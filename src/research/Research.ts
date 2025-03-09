import { plotHistoPriceComparison } from './crvUSD_Price.js';
import { checkTokenFlow } from './Flow.js';
import { checkLiveSpan } from './LiveSpan.js';
import { checkWhales } from './Whales.js';

export async function conductResearch(): Promise<void> {
  console.log('');
  console.log('conducting research...');
  console.log('');

  // checks the price over couple blocks, and compares the prices of the two aggregators
  // await plotHistoPriceComparison();

  // screens what happens with minted crvUSD
  // await checkTokenFlow();
  // await checkWhales();
  // await checkLiveSpan();
}
