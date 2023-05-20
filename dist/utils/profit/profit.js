import { getWeb3HttpProvider, getTxReceipt } from "../helperFunctions/Web3.js";
import fs from "fs";
import Big from "big.js";
import { getPrice } from "../priceAPI/priceAPI.js";
async function getEthPrice(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_TRICRYPTO = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const ABI_TRICRYPTO_RAW = fs.readFileSync("../JSONs/TRICRYPTOAbi.json", "utf8");
    const ABI_TRICRYPTO = JSON.parse(ABI_TRICRYPTO_RAW);
    const TRICRYPTO = new web3.eth.Contract(ABI_TRICRYPTO, ADDRESS_TRICRYPTO);
    try {
        return (await TRICRYPTO.methods.price_oracle(1).call(blockNumber)) / 1e18;
    }
    catch (error) {
        return null;
    }
}
async function getCosts(txHash, blockNumber) {
    let web3 = getWeb3HttpProvider();
    try {
        const txReceipt = await web3.eth.getTransactionReceipt(txHash);
        const gasUsed = txReceipt.gasUsed;
        const tx = await web3.eth.getTransaction(txHash);
        const gasPrice = tx.gasPrice;
        const cost = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPrice));
        let txCostInETHER = Number(web3.utils.fromWei(cost, "ether"));
        let etherPrice = await getEthPrice(blockNumber);
        if (!etherPrice)
            return null;
        let txCost = txCostInETHER * etherPrice;
        return txCost;
    }
    catch (error) {
        console.error(error);
        return null;
    }
}
async function adjustBalancesForDecimals(balanceChanges) {
    // Loop over each balance change
    for (let balanceChange of balanceChanges) {
        // Fetch the token's decimals and symbol
        const decimals = await getTokenDecimals(balanceChange.token);
        if (!decimals)
            return null;
        const symbol = await getTokenSymbol(balanceChange.token);
        if (!symbol)
            return null;
        // Create a Big.js instance of the balance change and the token's decimals
        const balanceBig = new Big(balanceChange.balanceChange);
        const decimalsBig = new Big(10).pow(decimals);
        // Divide the balance change by the token's decimals
        const adjustedBalance = balanceBig.div(decimalsBig).toString();
        // Update the balance change and token symbol
        balanceChange.balanceChange = adjustedBalance;
        balanceChange.tokenSymbol = symbol;
    }
    return balanceChanges;
}
async function getTokenSymbol(tokenAddress) {
    let web3 = getWeb3HttpProvider();
    const SYMBOL_ABI = [
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
    }
    catch (error) {
        return null;
    }
}
async function getTokenDecimals(tokenAddress) {
    let web3 = getWeb3HttpProvider();
    const DECIMALS_ABI = [
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
    }
    catch (error) {
        return null;
    }
}
function getTokenBalanceChanges(transferEvents, userAddress) {
    let balanceChangesMap = {};
    for (const event of transferEvents) {
        if (!(event.token in balanceChangesMap)) {
            balanceChangesMap[event.token] = BigInt(0);
        }
        let eventValue = BigInt(event.value);
        if (event.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] -= eventValue;
        }
        else if (event.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] += eventValue;
        }
    }
    console.log("balanceChangesMap", balanceChangesMap);
    const balanceChanges = [];
    for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
        if (balanceChange >= BigInt(100)) {
            // check if the balance change is greater or equal to 100
            balanceChanges.push({ token, balanceChange: balanceChange.toString() });
        }
    }
    return balanceChanges;
}
async function getEthBalanceChange(userAddress, blockNumber) {
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
function getWithdrawalEvents(receipt, userAddress) {
    const withdrawalEvents = [];
    let web3 = getWeb3HttpProvider();
    if (receipt.logs) {
        for (const log of receipt.logs) {
            // Adjust the topic to match the Withdrawal event signature
            if (log.topics[0] !== "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65") {
                continue;
            }
            // Decode the log
            const decodedLog = web3.eth.abi.decodeLog([
                { type: "address", indexed: true, name: "src" },
                { type: "uint256", indexed: false, name: "wad" },
            ], log.data, log.topics.slice(1));
            // Check if the withdrawal event concerns the userAddress
            if (decodedLog.src.toLowerCase() === userAddress.toLowerCase()) {
                // Create an object matching WithdrawalEvent interface
                const withdrawalEvent = {
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
function combineEvents(transferEvents, withdrawalEvents) {
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
function addEthBalanceChange(balanceChanges, ethBalanceChange) {
    if (ethBalanceChange !== "0") {
        balanceChanges.push({
            token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            balanceChange: ethBalanceChange,
        });
    }
    return balanceChanges;
}
async function calculateAbsDollarBalance(decimalAdjustedBalanceChanges, blockNumber) {
    let total = new Big(0);
    for (const item of decimalAdjustedBalanceChanges) {
        const price = await getPrice(item.token, blockNumber);
        if (price !== null) {
            const valueInDollars = new Big(item.balanceChange).times(price);
            total = total.plus(valueInDollars.abs());
        }
    }
    return total;
}
function getTransferEvents(receipt, userAddress) {
    const transferEvents = [];
    let web3 = getWeb3HttpProvider();
    if (receipt.logs) {
        for (const log of receipt.logs) {
            if (log.topics[0] !== "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
                continue;
            }
            // Decode the log
            const decodedLog = web3.eth.abi.decodeLog([
                { type: "address", indexed: true, name: "from" },
                { type: "address", indexed: true, name: "to" },
                { type: "uint256", indexed: false, name: "value" },
            ], log.data, log.topics.slice(1));
            // We check if this log is a transfer from or to the userAddress
            if (decodedLog.from.toLowerCase() === userAddress.toLowerCase() || decodedLog.to.toLowerCase() === userAddress.toLowerCase()) {
                // Create an object matching TransferEvent interface
                const transferEvent = {
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
async function getRevenue(event) {
    const txReceipt = await getTxReceipt(event.transactionHash);
    // console.log("txReceipt", txReceipt);
    const buyerTransfersInAndOut = getTransferEvents(txReceipt, event.returnValues.buyer);
    const wethWithdrawals = getWithdrawalEvents(txReceipt, event.returnValues.buyer);
    const combinedEvents = combineEvents(buyerTransfersInAndOut, wethWithdrawals);
    console.log("combinedEvents", combinedEvents);
    const balanceChanges = getTokenBalanceChanges(combinedEvents, event.returnValues.buyer);
    console.log("balanceChanges", balanceChanges);
    const ethBalanceChange = await getEthBalanceChange(event.returnValues.buyer, event.blockNumber);
    const balanceChangesWithEth = addEthBalanceChange(balanceChanges, ethBalanceChange);
    const decimalAdjustedBalanceChanges = await adjustBalancesForDecimals(balanceChangesWithEth);
    if (!decimalAdjustedBalanceChanges)
        return;
    console.log("decimalAdjustedBalanceChanges", decimalAdjustedBalanceChanges);
    const revenue = await calculateAbsDollarBalance(decimalAdjustedBalanceChanges, event.blockNumber);
    console.log("revenue", revenue);
    return revenue;
    //
}
export async function solveProfit(event) {
    console.log("event.transactionHash", event.transactionHash);
    let revenue = await getRevenue(event);
    if (!revenue)
        return;
    let cost = await getCosts(event.transactionHash, event.blockNumber);
    if (!cost)
        return;
    let profit = revenue - cost;
    return [profit, revenue, cost];
}
//# sourceMappingURL=profit.js.map