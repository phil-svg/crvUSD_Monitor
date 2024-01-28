import { AbiItem } from "web3-utils";

export const ABI_hacked_Coins: AbiItem[] = [
  { stateMutability: "view", type: "function", name: "coins", inputs: [{ name: "arg0", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
];

export const ABI_hacked_Symbol: AbiItem[] = [{ stateMutability: "view", type: "function", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }] }];
