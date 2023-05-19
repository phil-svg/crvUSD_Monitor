import { getWeb3HttpProvider, getTxReceipt } from "../helperFunctions/Web3.js";
import fs from "fs";
import Big from "big.js";
async function getEthPrice(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_TRICRYPTO = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const ABI_TRICRYPTO_RAW = fs.readFileSync("../JSONs/TRICRYPTOAbi.json", "utf8");
    const ABI_TRICRYPTO = JSON.parse(ABI_TRICRYPTO_RAW);
    const TRICRYPTO = new web3.eth.Contract(ABI_TRICRYPTO, ADDRESS_TRICRYPTO);
    try {
        return (await TRICRYPTO.methods.price_oracle(1).call(blockNumber)) / 1e18;
    }
    catch (errror) {
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
async function getsfxETHPrice(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_ORACLE = "0x19F5B81e5325F882C9853B5585f74f751DE3896d";
    const ABI_ORACLE_RAW = fs.readFileSync("../JSONs/OracleAbi.json", "utf8");
    const ABI_ORACLE = JSON.parse(ABI_ORACLE_RAW);
    const ORACLE = new web3.eth.Contract(ABI_ORACLE, ADDRESS_ORACLE);
    try {
        const PRICE = await ORACLE.methods.price().call(blockNumber);
        return PRICE;
    }
    catch (error) {
        return 0;
    }
}
async function getcrvUSDPrice(blockNumber) {
    let web3 = getWeb3HttpProvider();
    const ADDRESS_crvUSD_USDC_POOL = "0x4DEcE678ceceb27446b35C672dC7d61F30bAD69E";
    const ABI_crvUSD_USDC_POOL_RAW = fs.readFileSync("../JSONs/crvUSD_USDC_POOLAbi.json", "utf8");
    const ABI_crvUSD_USDC_POOL = JSON.parse(ABI_crvUSD_USDC_POOL_RAW);
    const crvUSD_USDC_POOL = new web3.eth.Contract(ABI_crvUSD_USDC_POOL, ADDRESS_crvUSD_USDC_POOL);
    let amountOf_crvUSD_perUSDC;
    try {
        amountOf_crvUSD_perUSDC = await crvUSD_USDC_POOL.methods.get_dy(0, 1, "1000000").call(blockNumber);
        amountOf_crvUSD_perUSDC = Number(amountOf_crvUSD_perUSDC / 1e18);
    }
    catch (error) {
        amountOf_crvUSD_perUSDC = 0;
    }
    const ADDRESS_crvUSD_USDT_POOL = "0x390f3595bCa2Df7d23783dFd126427CCeb997BF4";
    const ABI_crvUSD_USDT_POOL_RAW = fs.readFileSync("../JSONs/crvUSD_USDT_POOLAbi.json", "utf8");
    const ABI_crvUSD_USDT_POOL = JSON.parse(ABI_crvUSD_USDT_POOL_RAW);
    const crvUSD_USDT_POOL = new web3.eth.Contract(ABI_crvUSD_USDT_POOL, ADDRESS_crvUSD_USDT_POOL);
    let amountOf_crvUSD_perUSDT;
    try {
        amountOf_crvUSD_perUSDT = await crvUSD_USDT_POOL.methods.get_dy(0, 1, "1000000").call(blockNumber);
        amountOf_crvUSD_perUSDT = Number(amountOf_crvUSD_perUSDT / 1e18);
    }
    catch (error) {
        amountOf_crvUSD_perUSDT = 0;
    }
    if (amountOf_crvUSD_perUSDC === 0 && amountOf_crvUSD_perUSDT === 0)
        return null;
    return 1 / Math.min(amountOf_crvUSD_perUSDC, amountOf_crvUSD_perUSDT);
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
    console.log("balanceBefore", balanceBefore);
    let balanceAfter = await web3.eth.getBalance(userAddress, blockNumber + 1);
    console.log("balanceAfter", balanceAfter);
    // Calculate the difference in balances
    const balanceChange = web3.utils.toBN(balanceAfter).sub(web3.utils.toBN(balanceBefore));
    // Convert the balance change from Wei to Ether
    const balanceChangeEther = web3.utils.fromWei(balanceChange, "ether");
    return balanceChangeEther;
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
    let txReceipt = await getTxReceipt(event.transactionHash);
    let buyerTransfersInAndOut = getTransferEvents(txReceipt, event.returnValues.buyer);
    let balanceChanges = getTokenBalanceChanges(buyerTransfersInAndOut, event.returnValues.buyer);
    let adjustedBalanceChanges = await adjustBalancesForDecimals(balanceChanges);
    console.log("adjustedBalanceChanges", adjustedBalanceChanges);
    const balanceChange = await getEthBalanceChange(event.returnValues.buyer, event.blockNumber);
    console.log("balanceChange", balanceChange);
    //
}
export async function solveProfit(event, tokenSoldName, amount_sfrxETH, amount_crvUSD) {
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