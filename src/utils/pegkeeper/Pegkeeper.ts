import { getWeb3HttpProvider, getWeb3WsProvider } from "../helperFunctions/Web3.js";
import { ADDRESS_crvUSD, NULL_ADDRESS, addressAggMonetary } from "../Constants.js";
import { getPastEvents, subscribeToPegkeeperEvents, web3Call } from "../web3Calls/generic.js";
import { ABI_AggMonetaryPolicy } from "../abis/ABI_AggMonetaryPolicy.js";
import { ABI_Pegkeeper } from "../abis/ABI_Pegkeeper.js";
import { ABI_hacked_Coins, ABI_hacked_Symbol } from "../abis/ABI_Hacked.js";
import { getPriceOf_crvUSD } from "../priceAPI/priceAPI.js";
import { PegKeeperMessageContext, buildPegKeeperMessage } from "../telegram/TelegramBot.js";

async function getAllPegKeepersInfo(blockNumber: number): Promise<
  Array<{
    pegKeeperAddress: string;
    pool: string;
    coinAddress: string | null;
    coinSymbol: string | null;
  }>
> {
  const WEB3_WS_PROVIDER = getWeb3WsProvider();
  const pegkeeperAddressArrOnchain = await getPegkeeperAddressArrOnchain(blockNumber);
  let pegKeepersDetails = [];

  for (const pegKeeperAddress of pegkeeperAddressArrOnchain) {
    const PEG_KEEPER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_Pegkeeper, pegKeeperAddress);
    const pool = await web3Call(PEG_KEEPER_CONTRACT, "pool", []);

    const coinAddress = await getPegkeeperCoin(pool, WEB3_WS_PROVIDER);
    const coinSymbol = coinAddress ? await getCoinSymbol(coinAddress, WEB3_WS_PROVIDER) : null;

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
  let web3 = getWeb3HttpProvider();
  const AggMonetaryContract = new web3.eth.Contract(ABI_AggMonetaryPolicy, addressAggMonetary);

  let pegKeeperAddresses: string[] = [];
  let i = 0;
  let pegKeeperAddress = await web3Call(AggMonetaryContract, "peg_keepers", [i], blockNumber);
  while (pegKeeperAddress !== NULL_ADDRESS) {
    pegKeeperAddresses.push(pegKeeperAddress);
    i++;
    pegKeeperAddress = await web3Call(AggMonetaryContract, "peg_keepers", [i], blockNumber);
  }
  return pegKeeperAddresses;
}

async function getPegkeeperCoin(poolAddress: string, WEB3_WS_PROVIDER: any): Promise<string | null> {
  // I just assume we only have crvUSD for now, not, eg, crvEur. Then, needs further generalization (see: read: pegged on pegKeeperAddress)
  const Pool = new WEB3_WS_PROVIDER.eth.Contract(ABI_hacked_Coins, poolAddress);
  let coinAddress = await web3Call(Pool, "coins", [0]);
  if (coinAddress && coinAddress.toLowerCase() !== ADDRESS_crvUSD.toLowerCase()) return coinAddress;

  coinAddress = await web3Call(Pool, "coins", [1]);
  if (coinAddress && coinAddress.toLowerCase() !== ADDRESS_crvUSD.toLowerCase()) return coinAddress;

  return null;
}

async function getCoinSymbol(coinAddress: string, WEB3_WS_PROVIDER: any): Promise<string | null> {
  const COIN = new WEB3_WS_PROVIDER.eth.Contract(ABI_hacked_Symbol, coinAddress);
  let coinSymbol = await web3Call(COIN, "symbol", []);
  return coinSymbol;
}

async function getPegkeeperDebt(PEG_KEEPER_CONTRACT: any, blockNumber: number): Promise<number | null> {
  const debt = await web3Call(PEG_KEEPER_CONTRACT, "debt", [], blockNumber);
  if (!debt) return null;
  return Number((debt / 1e18).toFixed(0));
}

function extractSingleAmount(event: any): number {
  const dataString = event.raw.data;
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
    const provideEvents = await getPastEvents(PEG_KEEPER_CONTRACT, "Provide", startBlock, endBlock);
    const withdrawEvents = await getPastEvents(PEG_KEEPER_CONTRACT, "Withdraw", startBlock, endBlock);
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
  const WEB3_WS_PROVIDER = getWeb3WsProvider();

  let debtsSummary = [];

  for (const pegKeeperInfo of allPegKeepersInfo) {
    const debts = await getPegKeeperDebtAtBlocks(pegKeeperInfo, blockNumber, WEB3_WS_PROVIDER);
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

async function handleSingleEvent(event: any, allPegKeepersInfo: Array<PegKeeperDetail>, eventEmitter: any): Promise<void> {
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

  const BeforeAndAfterDebtsForAllPegKeepers = await calculateDebtsForAllPegKeepers(event.blockNumber, allPegKeepersInfo);

  const message = buildPegKeeperMessage(BeforeAndAfterDebtsForAllPegKeepers, context, event.transactionHash);
  eventEmitter.emit("newMessage", message);
}

export async function livemodePegKeepers(blockNumber: number, eventEmitter: any): Promise<void> {
  const WEB3_WS_PROVIDER = getWeb3WsProvider();
  const pegkeeperAddressArrOnchain = await getPegkeeperAddressArrOnchain(blockNumber);
  const allPegKeepersInfo = await getAllPegKeepersInfo(blockNumber);
  for (const address of pegkeeperAddressArrOnchain) {
    const PEG_KEEPER_CONTRACT = new WEB3_WS_PROVIDER.eth.Contract(ABI_Pegkeeper, address);
    subscribeToPegkeeperEvents(PEG_KEEPER_CONTRACT, eventEmitter);
  }
  eventEmitter.on("newPegKeeperEvent", async (event: any) => {
    if (event.event === "Provide" || event.event === "Withdraw") {
      await handleSingleEvent(event, allPegKeepersInfo, eventEmitter);
    }
  });
}

export async function pegkeeperHisto(eventEmitter: any, startBlock: number, endBlock: number): Promise<void> {
  const WEB3_WS_PROVIDER = getWeb3WsProvider();
  const allPegKeepersInfo = await getAllPegKeepersInfo(endBlock);
  const allHistoEvents = await getAllEvents(WEB3_WS_PROVIDER, startBlock, endBlock);

  for (const histoEvent of allHistoEvents) {
    await handleSingleEvent(histoEvent, allPegKeepersInfo, eventEmitter);
  }

  console.log("finished");
}
