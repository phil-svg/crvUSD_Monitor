import { getWeb3HttpProvider, getCallTraceViaAlchemy } from "../helperFunctions/Web3.js";
import fs from "fs";
import Big from "big.js";
import { getPrice } from "../priceAPI/priceAPI.js";
const ADDRESS_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ADDRESS_WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
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
        if (!decimals) {
            console.log("unknown decimals for", balanceChange.tokenSymbol, balanceChange.token);
            return null;
        }
        const symbol = await getTokenSymbol(balanceChange.token);
        if (!symbol) {
            console.log("unknown symbol for", balanceChange.tokenSymbol, balanceChange.token);
            return null;
        }
        // Create a Big.js instance of the balance change and the token's decimals
        const balanceBig = new Big(balanceChange.balanceChange);
        const decimalsBig = new Big(10).pow(decimals);
        // Divide the balance change by the token's decimals
        const adjustedBalance = balanceBig.div(decimalsBig).toString();
        // Update the balance change
        balanceChange.balanceChange = adjustedBalance;
        // Update the token symbol
        balanceChange.tokenSymbol = symbol;
    }
    return balanceChanges;
}
export async function getTokenSymbol(tokenAddress) {
    if (tokenAddress === ADDRESS_ETH)
        return "ETH";
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
export async function getTokenDecimals(tokenAddress) {
    if (tokenAddress === ADDRESS_ETH)
        return 18;
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
    const balanceChanges = [];
    for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
        if (balanceChange >= BigInt(100)) {
            // check if the balance change is greater or equal to 100
            balanceChanges.push({ token, balanceChange: balanceChange.toString() });
        }
    }
    return balanceChanges;
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
    if (ethBalanceChange !== 0) {
        balanceChanges.push({
            token: ADDRESS_ETH,
            balanceChange: ethBalanceChange,
        });
    }
    return balanceChanges;
}
async function calculateAbsDollarBalance(decimalAdjustedBalanceChanges, blockNumber) {
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
function calculateEthBalanceChange(callTrace, userAddress) {
    let balanceChange = 0;
    for (let i = 0; i < callTrace.length; i++) {
        const call = callTrace[i];
        // We only want to consider 'call' types for ETH transfers
        if (call.action.callType !== "call") {
            continue;
        }
        // Convert the value to a number for easier calculation
        const value = parseInt(call.action.value, 16);
        // If the user is the sender, decrease their balance
        if (call.action.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange -= value;
        }
        // If the user is the recipient, increase their balance
        if (call.action.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange += value;
        }
    }
    return balanceChange;
}
function getTransferEventsFromTrace(callTraces, userAddress) {
    const transferEvents = [];
    const transferMethodId = "0xa9059cbb";
    const userAddressLower = userAddress.toLowerCase();
    for (const callTrace of callTraces) {
        const action = callTrace.action;
        // Check if the input starts with the transfer method id
        if (action.input && action.input.toLowerCase().startsWith(transferMethodId)) {
            const sender = action.from;
            // Extract receiver and amount from the input
            const receiver = "0x" + action.input.slice(34, 74);
            const amountHex = action.input.slice(74, 138);
            const amount = BigInt("0x" + amountHex).toString(); // convert from hex to decimal
            // Check if this log is a transfer from or to the userAddress
            if (sender.toLowerCase() === userAddressLower || receiver.toLowerCase() === userAddressLower) {
                const transferEvent = {
                    from: sender,
                    to: receiver,
                    value: amount,
                    token: action.to, // Add the contract address receiving the call
                };
                transferEvents.push(transferEvent);
            }
        }
    }
    return transferEvents;
}
async function getRevenueForAddress(event, CALL_TRACE, user) {
    const userTransfersInAndOut = getTransferEventsFromTrace(CALL_TRACE, user);
    const weth_Withdrawals = checkCallTraceForWETH(CALL_TRACE, user);
    const combinedEvents = combineEvents(userTransfersInAndOut, weth_Withdrawals);
    const balanceChanges = getTokenBalanceChanges(combinedEvents, user);
    console.log("balanceChanges", user, balanceChanges);
    const ethBalanceChange = calculateEthBalanceChange(CALL_TRACE, user);
    const balanceChangesWithEth = addEthBalanceChange(balanceChanges, ethBalanceChange);
    const decimalAdjustedBalanceChanges = await adjustBalancesForDecimals(balanceChangesWithEth);
    console.log("decimalAdjustedBalanceChanges", decimalAdjustedBalanceChanges);
    if (!decimalAdjustedBalanceChanges)
        return 0;
    const revenue = await calculateAbsDollarBalance(decimalAdjustedBalanceChanges, event.blockNumber);
    return revenue;
}
function checkCallTraceForWETH(callTraces, userAddress) {
    const WETHAddress = ADDRESS_WETH;
    const transferMethodId = "0xa9059cbb";
    const results = [];
    const userAddressLower = userAddress.toLowerCase();
    for (let i = 0; i < callTraces.length; i++) {
        const callTrace = callTraces[i];
        const action = callTrace.action;
        // Only check the "to" field for the WETH address
        if (action.to && action.to.toLowerCase() === WETHAddress.toLowerCase()) {
            // Check if the input starts with the transfer method id
            if (action.input && action.input.toLowerCase().startsWith(transferMethodId)) {
                // Extract receiver and amount from the input
                // Assumes that the receiver address and amount are each 64 characters (32 bytes) long
                // and that they immediately follow the method id in the input string
                const receiver = "0x" + action.input.slice(34, 74);
                const amountHex = action.input.slice(74, 138);
                const amount = BigInt("0x" + amountHex).toString(); // convert from hex to decimal
                // Only add the result if the receiver matches the user address
                if (receiver.toLowerCase() === userAddressLower) {
                    results.push({
                        receiver,
                        wad: amount,
                        weth: WETHAddress,
                    });
                }
            }
        }
    }
    return results;
}
async function getRevenue(event) {
    console.log("txHash", event.transactionHash);
    const CALL_TRACE = await getCallTraceViaAlchemy(event.transactionHash);
    const buyer = CALL_TRACE[0].action.from;
    const to = CALL_TRACE[0].action.to;
    const revenueBuyer = await getRevenueForAddress(event, CALL_TRACE, buyer);
    const revenueTo = await getRevenueForAddress(event, CALL_TRACE, to);
    return Math.max(revenueBuyer, revenueTo);
}
export async function solveProfit(event) {
    let revenue = await getRevenue(event);
    console.log("final revenue", revenue);
    if (!revenue && revenue !== 0)
        return;
    let cost = await getCosts(event.transactionHash, event.blockNumber);
    if (!cost)
        return;
    let profit = revenue - cost;
    return [profit, revenue, cost];
}
//# sourceMappingURL=profit.js.map