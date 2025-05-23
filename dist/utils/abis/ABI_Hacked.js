export const ABI_hacked_Coins = [
    {
        stateMutability: 'view',
        type: 'function',
        name: 'coins',
        inputs: [{ name: 'arg0', type: 'uint256' }],
        outputs: [{ name: '', type: 'address' }],
    },
];
export const ABI_hacked_Symbol = [
    { stateMutability: 'view', type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }] },
];
export const ABI_hacked_Decimals = [
    { stateMutability: 'view', type: 'function', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
];
export const ABI_hacked_Transfer = [
    {
        name: 'Transfer',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'receiver', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
        ],
        anonymous: false,
        type: 'event',
    },
];
//# sourceMappingURL=ABI_Hacked.js.map