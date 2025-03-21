import { ADDRESS_crvUSD, NULL_ADDRESS, addressAggMonetary } from '../Constants.js';
import { ABI_AggMonetaryPolicy } from '../abis/ABI_AggMonetaryPolicy.js';
import { ABI_Pegkeeper } from '../abis/ABI_Pegkeeper.js';
import { ABI_hacked_Coins, ABI_hacked_Decimals, ABI_hacked_Symbol } from '../abis/ABI_Hacked.js';
import { getPriceOf_crvUSD } from '../priceAPI/priceAPI.js';
import { PegKeeperMessageContext, buildPegKeeperMessage } from '../telegram/TelegramBot.js';
import eventEmitter from '../EventEmitter.js';
import { getPastEvents, web3Call, web3HttpProvider } from '../web3/Web3Basics.js';
import { fetchEventsRealTime, registerHandler } from '../web3/AllEvents.js';

async function getAllPegKeepersInfo(blockNumber: number): Promise<
  Array<{
    pegKeeperAddress: string;
    pool: string;
    coinAddress: string | null;
    coinSymbol: string | null;
  }>
> {
  const pegkeeperAddressArrOnchain = await getPegkeeperAddressArrOnchain(blockNumber);
  let pegKeepersDetails = [];

  for (const pegKeeperAddress of pegkeeperAddressArrOnchain) {
    const PEG_KEEPER_CONTRACT = new web3HttpProvider.eth.Contract(ABI_Pegkeeper, pegKeeperAddress);
    const pool = await web3Call(PEG_KEEPER_CONTRACT, 'pool', []);

    const coinAddress = await getPegkeeperCoin(pool, web3HttpProvider);
    const coinSymbol = coinAddress ? await getCoinSymbol(coinAddress, web3HttpProvider) : null;

    pegKeepersDetails.push({
      pegKeeperAddress,
      pool,
      coinAddress,
      coinSymbol,
    });
  }

  return pegKeepersDetails;
}

async function getPegkeeperAddressArrOnchain(blockNumber: number): Promise<string[]> {
  const AggMonetaryContract = new web3HttpProvider.eth.Contract(ABI_AggMonetaryPolicy, addressAggMonetary);

  let pegKeeperAddresses: string[] = [];
  let i = 0;
  let pegKeeperAddress = await web3Call(AggMonetaryContract, 'peg_keepers', [i], blockNumber);
  while (pegKeeperAddress !== NULL_ADDRESS) {
    pegKeeperAddresses.push(pegKeeperAddress);
    i++;
    pegKeeperAddress = await web3Call(AggMonetaryContract, 'peg_keepers', [i], blockNumber);
  }
  return pegKeeperAddresses;
}

async function getPegkeeperCoin(poolAddress: string, WEB3_WS_PROVIDER: any): Promise<string | null> {
  // I just assume we only have crvUSD for now, not, eg, crvEur. Then, needs further generalization (see: read: pegged on pegKeeperAddress)
  const Pool = new WEB3_WS_PROVIDER.eth.Contract(ABI_hacked_Coins, poolAddress);
  let coinAddress = await web3Call(Pool, 'coins', [0]);
  if (coinAddress && coinAddress.toLowerCase() !== ADDRESS_crvUSD.toLowerCase()) return coinAddress;

  coinAddress = await web3Call(Pool, 'coins', [1]);
  if (coinAddress && coinAddress.toLowerCase() !== ADDRESS_crvUSD.toLowerCase()) return coinAddress;

  return null;
}

async function fetchDataWithRetry<T>(
  fetchFunction: () => Promise<T | null>,
  attempts: number = 3,
  delay: number = 200
): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fetchFunction();
      if (result !== null) {
        return result;
      } else {
        console.log(`Attempt ${attempt} returned null, retrying after ${delay}ms...`);
      }
    } catch (error) {
      console.log(`Attempt ${attempt} failed with error: ${error}. Retrying after ${delay}ms...`);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log('Failed to fetch data after maximum retry attempts');
  return null;
}

export async function getCoinSymbol(coinAddress: string, web3: any): Promise<string | null> {
  const COIN = new web3.eth.Contract(ABI_hacked_Symbol, coinAddress);
  try {
    let coinSymbol = await web3Call(COIN, 'symbol', []);
    return coinSymbol;
  } catch (error) {
    console.error(`Failed to fetch symbol for address ${coinAddress}:`, error);
    return null;
  }
}

export async function getCoinDecimals(coinAddress: string, web3: any): Promise<string | null> {
  return fetchDataWithRetry(async () => {
    const COIN = new web3.eth.Contract(ABI_hacked_Decimals, coinAddress);
    try {
      let coinDecimals = await web3Call(COIN, 'decimals', []);
      return coinDecimals;
    } catch (error) {
      console.error(`Failed to fetch decimals for address ${coinAddress}:`, error);
      return null;
    }
  });
}

async function getPegkeeperDebt(PEG_KEEPER_CONTRACT: any, blockNumber: number): Promise<number | null> {
  const debt = await web3Call(PEG_KEEPER_CONTRACT, 'debt', [], blockNumber);
  if (!debt) return null;
  return Number((debt / 1e18).toFixed(0));
}

function extractSingleAmount(event: any): number {
  const dataString = event.returnValues.amount;
  const amountBigInt = BigInt(dataString);
  const amountInEther = amountBigInt / BigInt(1e18);
  return Number(Number(amountInEther).toFixed(0));
}

export type PegKeeperDebtInfo = {
  coinSymbol: string | null;
  address: string;
  debtAtBlock: number | null;
  debtAtPreviousBlock: number | null;
};

async function getAllEvents(WEB3_WS_PROVIDER: any, startBlock: number, endBlock: number): Promise<any[]> {
  const pegkeeperAddresses = await getPegkeeperAddressArrOnchain(endBlock);
  let allEvents: any[] = [];

  // Collect events for each pegkeeper
  for (const address of pegkeeperAddresses) {
    const PEG_KEEPER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_Pegkeeper, address);
    const provideEvents = await getPastEvents(PEG_KEEPER_CONTRACT, 'Provide', startBlock, endBlock);
    const withdrawEvents = await getPastEvents(PEG_KEEPER_CONTRACT, 'Withdraw', startBlock, endBlock);
    allEvents = allEvents.concat(provideEvents, withdrawEvents);
  }

  // Sort events by blockNumber, then transactionIndex
  allEvents.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return a.transactionIndex - b.transactionIndex;
    }
    return a.blockNumber - b.blockNumber;
  });

  return allEvents;
}

async function getPegKeeperDebtAtBlocks(
  pegKeeperInfo: { pegKeeperAddress: string },
  blockNumber: number,
  WEB3_WS_PROVIDER: any
): Promise<{
  address: string;
  debtAtBlock: number | null;
  debtAtPreviousBlock: number | null;
}> {
  const PEG_KEEPER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_Pegkeeper, pegKeeperInfo.pegKeeperAddress);

  // Fetch debt at the specified block number
  const debtAtBlock = await getPegkeeperDebt(PEG_KEEPER_CONTRACT, blockNumber);

  // Fetch debt at one block before the specified block number
  const debtAtPreviousBlock = await getPegkeeperDebt(PEG_KEEPER_CONTRACT, blockNumber - 1);

  return {
    address: pegKeeperInfo.pegKeeperAddress,
    debtAtBlock,
    debtAtPreviousBlock,
  };
}

export async function calculateDebtsForAllPegKeepers(
  blockNumber: number,
  allPegKeepersInfo: Array<{
    pegKeeperAddress: string;
    pool: string;
    coinAddress: string | null;
    coinSymbol: string | null;
  }>
): Promise<
  Array<{
    coinSymbol: string | null;
    address: string;
    debtAtBlock: number | null;
    debtAtPreviousBlock: number | null;
  }>
> {
  let debtsSummary = [];

  for (const pegKeeperInfo of allPegKeepersInfo) {
    const debts = await getPegKeeperDebtAtBlocks(pegKeeperInfo, blockNumber, web3HttpProvider);
    debtsSummary.push({
      coinSymbol: pegKeeperInfo.coinSymbol,
      ...debts,
    });
  }
  return debtsSummary;
}

interface PegKeeperDetail {
  pegKeeperAddress: string;
  pool: string;
  coinAddress: string | null;
  coinSymbol: string | null;
}

async function handleSingleEvent(
  event: any,
  allPegKeepersInfo: Array<PegKeeperDetail>,
  eventEmitter: any
): Promise<void> {
  // Assuming extractSingleAmount and getPriceOf_crvUSD functions are correctly implemented
  const amount = extractSingleAmount(event);
  let crvUSD_Price_Before = await getPriceOf_crvUSD(event.blockNumber - 1);
  let crvUSD_Price_After = await getPriceOf_crvUSD(event.blockNumber);

  const context: PegKeeperMessageContext = {
    event: event.event,
    amount: amount,
    priceBefore: Number(crvUSD_Price_Before?.toFixed(8)),
    priceAfter: Number(crvUSD_Price_After?.toFixed(8)),
  };

  const BeforeAndAfterDebtsForAllPegKeepers = await calculateDebtsForAllPegKeepers(
    event.blockNumber,
    allPegKeepersInfo
  );

  // checks if the debt crossed a million dollar boundary. eg: 39,999 => 40. If not, skips, eg: 39,444=> 39,600
  const actuallyPrint = BeforeAndAfterDebtsForAllPegKeepers.some(({ debtAtPreviousBlock, debtAtBlock }) => {
    if (debtAtPreviousBlock == null || debtAtBlock == null) return false;

    const prevMil = Math.floor(debtAtPreviousBlock / 1_000_000);
    const currMil = Math.floor(debtAtBlock / 1_000_000);

    return prevMil !== currMil;
  });

  if (actuallyPrint) {
    const message = buildPegKeeperMessage(BeforeAndAfterDebtsForAllPegKeepers, context, event.transactionHash);
    eventEmitter.emit('newMessage', message);
  }
}

export async function livemodePegKeepers(blockNumber: number): Promise<void> {
  const pegkeeperAddressArrOnchain = await getPegkeeperAddressArrOnchain(blockNumber);
  const allPegKeepersInfo = await getAllPegKeepersInfo(blockNumber);
  for (const address of pegkeeperAddressArrOnchain) {
    subscribeToPegkeeperEvents(address, ABI_Pegkeeper);
  }
  eventEmitter.on('newPegKeeperEvent', async (event: any) => {
    if (event.event === 'Provide' || event.event === 'Withdraw') {
      await handleSingleEvent(event, allPegKeepersInfo, eventEmitter);
    }
  });
}

async function subscribeToPegkeeperEvents(address: string, abi: any) {
  try {
    registerHandler(async (logs) => {
      const events = await fetchEventsRealTime(logs, address, abi, 'AllEvents');
      if (events.length > 0) {
        events.forEach((event: any) => {
          eventEmitter.emit('newPegKeeperEvent', event);
        });
      }
    });
  } catch (err) {
    console.log('Error in fetching events:', err);
  }
}

export async function pegkeeperHisto(eventEmitter: any, startBlock: number, endBlock: number): Promise<void> {
  const allPegKeepersInfo = await getAllPegKeepersInfo(endBlock);
  const allHistoEvents = await getAllEvents(web3HttpProvider, startBlock, endBlock);

  for (const histoEvent of allHistoEvents) {
    await handleSingleEvent(histoEvent, allPegKeepersInfo, eventEmitter);
  }

  console.log('finished');
}
