import { Multicall } from 'ethereum-multicall';
import fs from 'fs/promises';
import { web3Call, web3HttpProvider } from '../utils/web3/Web3Basics';
async function fetchMarkets() {
    const url = 'https://prices.curve.finance/v1/crvusd/markets/ethereum?fetch_on_chain=false&page=1&per_page=100';
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const data = (await response.json());
        return data;
    }
    catch (error) {
        console.error('Error fetching market data:', error);
        throw error;
    }
}
function getMintMarketControllerAbi() {
    const abi = [
        {
            name: 'UserState',
            inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'collateral', type: 'uint256', indexed: false },
                { name: 'debt', type: 'uint256', indexed: false },
                { name: 'n1', type: 'int256', indexed: false },
                { name: 'n2', type: 'int256', indexed: false },
                { name: 'liquidation_discount', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'Borrow',
            inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'collateral_increase', type: 'uint256', indexed: false },
                { name: 'loan_increase', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'Repay',
            inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'collateral_decrease', type: 'uint256', indexed: false },
                { name: 'loan_decrease', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'RemoveCollateral',
            inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'collateral_decrease', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'Liquidate',
            inputs: [
                { name: 'liquidator', type: 'address', indexed: true },
                { name: 'user', type: 'address', indexed: true },
                { name: 'collateral_received', type: 'uint256', indexed: false },
                { name: 'stablecoin_received', type: 'uint256', indexed: false },
                { name: 'debt', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'SetMonetaryPolicy',
            inputs: [{ name: 'monetary_policy', type: 'address', indexed: false }],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'SetBorrowingDiscounts',
            inputs: [
                { name: 'loan_discount', type: 'uint256', indexed: false },
                { name: 'liquidation_discount', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            name: 'CollectFees',
            inputs: [
                { name: 'amount', type: 'uint256', indexed: false },
                { name: 'new_supply', type: 'uint256', indexed: false },
            ],
            anonymous: false,
            type: 'event',
        },
        {
            stateMutability: 'nonpayable',
            type: 'constructor',
            inputs: [
                { name: 'collateral_token', type: 'address' },
                { name: 'monetary_policy', type: 'address' },
                { name: 'loan_discount', type: 'uint256' },
                { name: 'liquidation_discount', type: 'uint256' },
                { name: 'amm', type: 'address' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'pure',
            type: 'function',
            name: 'factory',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
        },
        { stateMutability: 'pure', type: 'function', name: 'amm', inputs: [], outputs: [{ name: '', type: 'address' }] },
        {
            stateMutability: 'pure',
            type: 'function',
            name: 'collateral_token',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
        },
        {
            stateMutability: 'pure',
            type: 'function',
            name: 'borrowed_token',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
        },
        { stateMutability: 'nonpayable', type: 'function', name: 'save_rate', inputs: [], outputs: [] },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'debt',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'loan_exists',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'bool' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'total_debt',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'max_borrowable',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'N', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'max_borrowable',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'N', type: 'uint256' },
                { name: 'current_debt', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'min_collateral',
            inputs: [
                { name: 'debt', type: 'uint256' },
                { name: 'N', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'calculate_debt_n1',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'debt', type: 'uint256' },
                { name: 'N', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'int256' }],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'create_loan',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'debt', type: 'uint256' },
                { name: 'N', type: 'uint256' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'create_loan_extended',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'debt', type: 'uint256' },
                { name: 'N', type: 'uint256' },
                { name: 'callbacker', type: 'address' },
                { name: 'callback_args', type: 'uint256[]' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'add_collateral',
            inputs: [{ name: 'collateral', type: 'uint256' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'add_collateral',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: '_for', type: 'address' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'remove_collateral',
            inputs: [{ name: 'collateral', type: 'uint256' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'remove_collateral',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'use_eth', type: 'bool' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'borrow_more',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'debt', type: 'uint256' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'borrow_more_extended',
            inputs: [
                { name: 'collateral', type: 'uint256' },
                { name: 'debt', type: 'uint256' },
                { name: 'callbacker', type: 'address' },
                { name: 'callback_args', type: 'uint256[]' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'repay',
            inputs: [{ name: '_d_debt', type: 'uint256' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'repay',
            inputs: [
                { name: '_d_debt', type: 'uint256' },
                { name: '_for', type: 'address' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'repay',
            inputs: [
                { name: '_d_debt', type: 'uint256' },
                { name: '_for', type: 'address' },
                { name: 'max_active_band', type: 'int256' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'repay',
            inputs: [
                { name: '_d_debt', type: 'uint256' },
                { name: '_for', type: 'address' },
                { name: 'max_active_band', type: 'int256' },
                { name: 'use_eth', type: 'bool' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'repay_extended',
            inputs: [
                { name: 'callbacker', type: 'address' },
                { name: 'callback_args', type: 'uint256[]' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'health_calculator',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'd_collateral', type: 'int256' },
                { name: 'd_debt', type: 'int256' },
                { name: 'full', type: 'bool' },
            ],
            outputs: [{ name: '', type: 'int256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'health_calculator',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'd_collateral', type: 'int256' },
                { name: 'd_debt', type: 'int256' },
                { name: 'full', type: 'bool' },
                { name: 'N', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'int256' }],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'liquidate',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'min_x', type: 'uint256' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'liquidate',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'min_x', type: 'uint256' },
                { name: 'use_eth', type: 'bool' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'liquidate_extended',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'min_x', type: 'uint256' },
                { name: 'frac', type: 'uint256' },
                { name: 'use_eth', type: 'bool' },
                { name: 'callbacker', type: 'address' },
                { name: 'callback_args', type: 'uint256[]' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'tokens_to_liquidate',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'tokens_to_liquidate',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'frac', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'health',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'int256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'health',
            inputs: [
                { name: 'user', type: 'address' },
                { name: 'full', type: 'bool' },
            ],
            outputs: [{ name: '', type: 'int256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'users_to_liquidate',
            inputs: [],
            outputs: [
                {
                    name: '',
                    type: 'tuple[]',
                    components: [
                        { name: 'user', type: 'address' },
                        { name: 'x', type: 'uint256' },
                        { name: 'y', type: 'uint256' },
                        { name: 'debt', type: 'uint256' },
                        { name: 'health', type: 'int256' },
                    ],
                },
            ],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'users_to_liquidate',
            inputs: [{ name: '_from', type: 'uint256' }],
            outputs: [
                {
                    name: '',
                    type: 'tuple[]',
                    components: [
                        { name: 'user', type: 'address' },
                        { name: 'x', type: 'uint256' },
                        { name: 'y', type: 'uint256' },
                        { name: 'debt', type: 'uint256' },
                        { name: 'health', type: 'int256' },
                    ],
                },
            ],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'users_to_liquidate',
            inputs: [
                { name: '_from', type: 'uint256' },
                { name: '_limit', type: 'uint256' },
            ],
            outputs: [
                {
                    name: '',
                    type: 'tuple[]',
                    components: [
                        { name: 'user', type: 'address' },
                        { name: 'x', type: 'uint256' },
                        { name: 'y', type: 'uint256' },
                        { name: 'debt', type: 'uint256' },
                        { name: 'health', type: 'int256' },
                    ],
                },
            ],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'amm_price',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'user_prices',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'uint256[2]' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'user_state',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'uint256[4]' }],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'set_amm_fee',
            inputs: [{ name: 'fee', type: 'uint256' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'set_amm_admin_fee',
            inputs: [{ name: 'fee', type: 'uint256' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'set_monetary_policy',
            inputs: [{ name: 'monetary_policy', type: 'address' }],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'set_borrowing_discounts',
            inputs: [
                { name: 'loan_discount', type: 'uint256' },
                { name: 'liquidation_discount', type: 'uint256' },
            ],
            outputs: [],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'set_callback',
            inputs: [{ name: 'cb', type: 'address' }],
            outputs: [],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'admin_fees',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'nonpayable',
            type: 'function',
            name: 'collect_fees',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'check_lock',
            inputs: [],
            outputs: [{ name: '', type: 'bool' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'liquidation_discounts',
            inputs: [{ name: 'arg0', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'loans',
            inputs: [{ name: 'arg0', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'loan_ix',
            inputs: [{ name: 'arg0', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'n_loans',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'minted',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'redeemed',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'monetary_policy',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'liquidation_discount',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
        {
            stateMutability: 'view',
            type: 'function',
            name: 'loan_discount',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
        },
    ];
    return abi;
}
async function getAllMintMarketUserEver(market, blockNumber) {
    var _a, _b;
    // Multicall setup
    const multicall = new Multicall({ web3Instance: web3HttpProvider, tryAggregate: true });
    const batchSize = 500;
    let startIndex = 0;
    const addresses = [];
    let shouldBreak = false;
    const abi = getMintMarketControllerAbi();
    while (!shouldBreak) {
        const calls = [];
        for (let i = startIndex; i < startIndex + batchSize; i++) {
            calls.push({
                reference: `loans-${i}`,
                contractAddress: market.address,
                abi: abi,
                calls: [
                    {
                        reference: `call-${i}`,
                        methodName: 'loans',
                        methodParameters: [i],
                    },
                ],
            });
        }
        // Execute multicall
        try {
            const results = await multicall.call(calls, {
                blockNumber: Number(blockNumber).toString(),
            });
            for (let i = 0; i < batchSize; i++) {
                const loanResult = (_a = results.results[`loans-${startIndex + i}`]) === null || _a === void 0 ? void 0 : _a.callsReturnContext[0];
                const userAddress = (_b = loanResult === null || loanResult === void 0 ? void 0 : loanResult.returnValues) === null || _b === void 0 ? void 0 : _b[0];
                if (!userAddress || userAddress === '0x0000000000000000000000000000000000000000') {
                    shouldBreak = true;
                    break;
                }
                addresses.push(userAddress);
            }
            startIndex += batchSize;
        }
        catch (error) {
            console.error('Error in multicall execution:', error);
            shouldBreak = true;
        }
    }
    // Remove duplicates
    return [...new Set(addresses)];
}
async function getUsersDebtInMarket(user, market, blockNumber) {
    const abi = getMintMarketControllerAbi();
    const contract = new web3HttpProvider.eth.Contract(abi, market.address);
    const debt = await web3Call(contract, 'debt', [user], blockNumber);
    return debt / 1e18;
}
async function handleMarket(market, blockNumber, userDebtMap) {
    const allUsersEver = await getAllMintMarketUserEver(market, blockNumber);
    console.log('allUsersEver', allUsersEver);
    console.log('market', market);
    for (const user of allUsersEver) {
        const debt = await getUsersDebtInMarket(user, market, blockNumber);
        if (debt > 0) {
            // Add to or update the debt map
            if (userDebtMap.has(user)) {
                userDebtMap.set(user, userDebtMap.get(user) + debt);
            }
            else {
                userDebtMap.set(user, debt);
            }
        }
    }
}
export async function checkWhales() {
    console.time();
    const startBlock = 21303934;
    const endBlock = 21508167;
    const marketsResponse = await fetchMarkets();
    const markets = marketsResponse.data;
    const userDebtMap = new Map();
    for (const market of markets) {
        await handleMarket(market, endBlock, userDebtMap);
    }
    // Convert Map to an array and sort from high to low
    const sortedUserDebtArray = Array.from(userDebtMap.entries())
        .map(([user, debt]) => ({ user, debt }))
        .sort((a, b) => b.debt - a.debt);
    // Save to JSON file
    const jsonFilePath = './userDebtData.json';
    await fs.writeFile(jsonFilePath, JSON.stringify(sortedUserDebtArray, null, 2), 'utf-8');
    console.log(`User debt data saved to ${jsonFilePath}`);
    console.timeEnd();
}
//# sourceMappingURL=Whales.js.map