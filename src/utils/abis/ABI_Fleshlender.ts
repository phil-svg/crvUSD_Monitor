import { AbiItem } from 'web3-utils';

export const ABI_Fleshlender: AbiItem[] = [
  {
    name: 'FlashLoan',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
    type: 'event',
  },
  { stateMutability: 'nonpayable', type: 'constructor', inputs: [{ name: 'factory', type: 'address' }], outputs: [] },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'supportedTokens',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'flashLoan',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'flashFee',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'maxFlashLoan',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { stateMutability: 'view', type: 'function', name: 'version', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { stateMutability: 'view', type: 'function', name: 'fee', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
];
