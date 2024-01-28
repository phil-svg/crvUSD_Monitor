import { AbiItem } from "web3-utils";

export const ABI_priceOracle: AbiItem[] = [
  {
    stateMutability: "nonpayable",
    type: "constructor",
    inputs: [
      { name: "tricrypto", type: "address" },
      { name: "ix", type: "uint256" },
      { name: "stableswap", type: "address" },
      { name: "staked_swap", type: "address" },
      { name: "stable_aggregator", type: "address" },
      { name: "chainlink_aggregator", type: "address" },
      { name: "sfrxeth", type: "address" },
      { name: "ma_exp_time", type: "uint256" },
      { name: "bound_size", type: "uint256" },
    ],
    outputs: [],
  },
  { stateMutability: "view", type: "function", name: "tricrypto", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "stableswap_aggregator", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "stableswap", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "staked_swap", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "stablecoin", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "redeemable", inputs: [], outputs: [{ name: "", type: "address" }] },
  { stateMutability: "view", type: "function", name: "ma_exp_time", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { stateMutability: "view", type: "function", name: "raw_price", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { stateMutability: "view", type: "function", name: "price", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { stateMutability: "nonpayable", type: "function", name: "price_w", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { stateMutability: "view", type: "function", name: "last_price", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { stateMutability: "view", type: "function", name: "last_timestamp", inputs: [], outputs: [{ name: "", type: "uint256" }] },
];
