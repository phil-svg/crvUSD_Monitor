import { getWeb3HttpProvider, getTxReceipt } from "../helperFunctions/Web3.js";
import fs from "fs";
import { TransactionReceipt } from "web3-eth";
import { AbiItem } from "web3-utils";
import Big from "big.js";
import { getPrice } from "../priceAPI/priceAPI.js";
import { getTxFromTxHash } from "../web3Calls/generic.js";

async function getEthPrice(blockNumber: number): Promise<number | null> {
  let web3 = getWeb3HttpProvider();
  const ADDRESS_TRICRYPTO = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
  const ABI_TRICRYPTO_RAW = fs.readFileSync("../JSONs/TRICRYPTOAbi.json", "utf8");
  const ABI_TRICRYPTO = JSON.parse(ABI_TRICRYPTO_RAW);

  const TRICRYPTO = new web3.eth.Contract(ABI_TRICRYPTO, ADDRESS_TRICRYPTO);

  try {
    return (await TRICRYPTO.methods.price_oracle(1).call(blockNumber)) / 1e18;
  } catch (error) {
    return null;
  }
}

async function getCosts(txHash: string, blockNumber: number): Promise<number | null> {
  let web3 = getWeb3HttpProvider();
  try {
    const txReceipt = await web3.eth.getTransactionReceipt(txHash);
    const gasUsed = txReceipt.gasUsed;

    const tx = await web3.eth.getTransaction(txHash);
    const gasPrice = tx.gasPrice;

    const cost = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPrice));

    let txCostInETHER = Number(web3.utils.fromWei(cost, "ether"));

    let etherPrice = await getEthPrice(blockNumber);
    if (!etherPrice) return null;

    let txCost = txCostInETHER * etherPrice;

    return txCost;
  } catch (error) {
    console.error(error);
    return null;
  }
}

interface BalanceChange {
  token: string;
  balanceChange: string;
  tokenSymbol?: string;
}

async function adjustBalancesForDecimals(balanceChanges: BalanceChange[]): Promise<BalanceChange[] | null> {
  // Loop over each balance change
  for (let balanceChange of balanceChanges) {
    // Fetch the token's decimals and symbol
    const decimals = await getTokenDecimals(balanceChange.token);
    if (!decimals) return null;
    const symbol = await getTokenSymbol(balanceChange.token);
    if (!symbol) return null;

    // If token is not ETH, adjust the balance change
    if (symbol !== "ETH") {
      // Create a Big.js instance of the balance change and the token's decimals
      const balanceBig = new Big(balanceChange.balanceChange);
      const decimalsBig = new Big(10).pow(decimals);

      // Divide the balance change by the token's decimals
      const adjustedBalance = balanceBig.div(decimalsBig).toString();

      // Update the balance change
      balanceChange.balanceChange = adjustedBalance;
    }

    // Update the token symbol
    balanceChange.tokenSymbol = symbol;
  }

  return balanceChanges;
}

export async function getTokenSymbol(tokenAddress: string): Promise<string | null> {
  if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return "ETH";

  let web3 = getWeb3HttpProvider();
  const SYMBOL_ABI: AbiItem[] = [
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  const CONTRACT = new web3.eth.Contract(SYMBOL_ABI, tokenAddress);
  try {
    return await CONTRACT.methods.symbol().call();
  } catch (error) {
    return null;
  }
}

export async function getTokenDecimals(tokenAddress: string): Promise<number | null> {
  if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return 18;
  let web3 = getWeb3HttpProvider();
  const DECIMALS_ABI: AbiItem[] = [
    {
      inputs: [],
      name: "decimals",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  const CONTRACT = new web3.eth.Contract(DECIMALS_ABI, tokenAddress);
  try {
    return Number(await CONTRACT.methods.decimals().call());
  } catch (error) {
    return null;
  }
}

interface BalanceChange {
  token: string;
  balanceChange: string;
}

function getTokenBalanceChanges(transferEvents: TransferEvent[], userAddress: string): BalanceChange[] {
  let balanceChangesMap: { [key: string]: bigint } = {};

  for (const event of transferEvents) {
    if (!(event.token in balanceChangesMap)) {
      balanceChangesMap[event.token] = BigInt(0);
    }

    let eventValue = BigInt(event.value);

    if (event.from.toLowerCase() === userAddress.toLowerCase()) {
      balanceChangesMap[event.token] -= eventValue;
    } else if (event.to.toLowerCase() === userAddress.toLowerCase()) {
      balanceChangesMap[event.token] += eventValue;
    }
  }

  const balanceChanges: BalanceChange[] = [];
  for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
    if (balanceChange >= BigInt(100)) {
      // check if the balance change is greater or equal to 100
      balanceChanges.push({ token, balanceChange: balanceChange.toString() });
    }
  }

  return balanceChanges;
}

interface TransferEvent {
  from: string;
  to: string;
  value: string;
  token: string; // Add a token field to store contract address
}

async function getEthBalanceChange(userAddress: string, blockNumber: number): Promise<string> {
  let web3 = getWeb3HttpProvider();

  // Fetch the user's Ether balance one block before and one block after the transaction
  let balanceBefore = await web3.eth.getBalance(userAddress, blockNumber - 1);
  let balanceAfter = await web3.eth.getBalance(userAddress, blockNumber);

  // Calculate the difference in balances
  const balanceChange = web3.utils.toBN(balanceAfter).sub(web3.utils.toBN(balanceBefore));

  // Convert the balance change from Wei to Ether
  const balanceChangeEther = web3.utils.fromWei(balanceChange, "ether");

  return balanceChangeEther;
}

interface WithdrawalEvent {
  receiver: string;
  wad: string;
  weth: string;
}

function getWithdrawalEvents(receipt: TransactionReceipt, userAddress: string): WithdrawalEvent[] {
  const withdrawalEvents: WithdrawalEvent[] = [];
  let web3 = getWeb3HttpProvider();

  if (receipt.logs) {
    for (const log of receipt.logs) {
      // Adjust the topic to match the Withdrawal event signature
      if (log.topics[0] !== "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65") {
        continue;
      }

      // Decode the log
      const decodedLog: any = web3.eth.abi.decodeLog(
        [
          { type: "address", indexed: true, name: "src" },
          { type: "uint256", indexed: false, name: "wad" },
        ],
        log.data,
        log.topics.slice(1)
      );

      // Check if the withdrawal event concerns the userAddress
      if (decodedLog.src.toLowerCase() === userAddress.toLowerCase()) {
        // Create an object matching WithdrawalEvent interface
        const withdrawalEvent: WithdrawalEvent = {
          receiver: decodedLog.src,
          wad: decodedLog.wad,
          weth: log.address, // Add the contract address generating this log
        };
        withdrawalEvents.push(withdrawalEvent);
      }
    }
  }
  return withdrawalEvents;
}

function combineEvents(transferEvents: any[], withdrawalEvents: WithdrawalEvent[]): any[] {
  // Map withdrawal events to match TransferEvent format
  const formattedWithdrawals = withdrawalEvents.map((withdrawalEvent) => ({
    from: withdrawalEvent.receiver,
    to: withdrawalEvent.weth,
    value: withdrawalEvent.wad,
    token: withdrawalEvent.weth,
  }));

  // Return a new array combining both transfer and withdrawal events
  return [...transferEvents, ...formattedWithdrawals];
}

function addEthBalanceChange(balanceChanges: any[], ethBalanceChange: string): any[] {
  if (ethBalanceChange !== "0") {
    balanceChanges.push({
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      balanceChange: ethBalanceChange,
    });
  }
  return balanceChanges;
}

async function calculateAbsDollarBalance(decimalAdjustedBalanceChanges: any[], blockNumber: number): Promise<number> {
  let total = 0;

  for (const item of decimalAdjustedBalanceChanges) {
    const price = await getPrice(item.token, blockNumber);

    if (price !== null) {
      const valueInDollars = item.balanceChange * price;
      total += valueInDollars;
    }
  }

  return total;
}

function getTransferEvents(receipt: TransactionReceipt, userAddress: string): TransferEvent[] {
  const transferEvents: TransferEvent[] = [];
  let web3 = getWeb3HttpProvider();

  if (receipt.logs) {
    for (const log of receipt.logs) {
      if (log.topics[0] !== "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        continue;
      }

      // Decode the log
      const decodedLog: any = web3.eth.abi.decodeLog(
        [
          { type: "address", indexed: true, name: "from" },
          { type: "address", indexed: true, name: "to" },
          { type: "uint256", indexed: false, name: "value" },
        ],
        log.data,
        log.topics.slice(1)
      );

      // We check if this log is a transfer from or to the userAddress
      if (decodedLog.from.toLowerCase() === userAddress.toLowerCase() || decodedLog.to.toLowerCase() === userAddress.toLowerCase()) {
        // Create an object matching TransferEvent interface
        const transferEvent: TransferEvent = {
          from: decodedLog.from,
          to: decodedLog.to,
          value: decodedLog.value,
          token: log.address, // Add the contract address generating this log
        };
        transferEvents.push(transferEvent);
      }
    }
  }
  return transferEvents;
}

async function getRevenue(event: any): Promise<any> {
  const txReceipt = await getTxReceipt(event.transactionHash);
  const tx = await getTxFromTxHash(event.transactionHash);
  const buyer = tx.from;

  const buyerTransfersInAndOut = getTransferEvents(txReceipt, buyer);

  const wethWithdrawals = getWithdrawalEvents(txReceipt, buyer);

  const combinedEvents = combineEvents(buyerTransfersInAndOut, wethWithdrawals);

  const balanceChanges = getTokenBalanceChanges(combinedEvents, buyer);

  const ethBalanceChange = await getEthBalanceChange(buyer, event.blockNumber);

  const balanceChangesWithEth = addEthBalanceChange(balanceChanges, ethBalanceChange);

  const decimalAdjustedBalanceChanges = await adjustBalancesForDecimals(balanceChangesWithEth);
  if (!decimalAdjustedBalanceChanges) return;

  const revenue = await calculateAbsDollarBalance(decimalAdjustedBalanceChanges, event.blockNumber);
  return revenue;
}

export async function solveProfit(event: any): Promise<number[] | void> {
  let revenue = await getRevenue(event);
  if (!revenue) return;
  let cost = await getCosts(event.transactionHash, event.blockNumber);
  if (!cost) return;
  let profit = revenue - cost;
  return [profit, revenue, cost];
}
