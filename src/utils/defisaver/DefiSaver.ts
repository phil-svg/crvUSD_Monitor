import { getWeb3HttpProvider } from "../helperFunctions/Web3.js";
import { AbiItem } from "web3-utils";
import { web3Call } from "../web3Calls/generic.js";

export async function getDSProxyOwner(DSProxyAddress: string): Promise<string> {
  const web3HttpProvider = getWeb3HttpProvider();
  const DSProxyFactory = new web3HttpProvider.eth.Contract(DSProxyWallet_ABI, DSProxyAddress);
  const res = await web3Call(DSProxyFactory, "owner", []);
  return res;
}

const DSProxyWallet_ABI: AbiItem[] = [
  { constant: false, inputs: [{ name: "owner_", type: "address" }], name: "setOwner", outputs: [], payable: false, stateMutability: "nonpayable", type: "function" },
  {
    constant: false,
    inputs: [
      { name: "_target", type: "address" },
      { name: "_data", type: "bytes" },
    ],
    name: "execute",
    outputs: [{ name: "response", type: "bytes32" }],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_code", type: "bytes" },
      { name: "_data", type: "bytes" },
    ],
    name: "execute",
    outputs: [
      { name: "target", type: "address" },
      { name: "response", type: "bytes32" },
    ],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  { constant: true, inputs: [], name: "cache", outputs: [{ name: "", type: "address" }], payable: false, stateMutability: "view", type: "function" },
  { constant: false, inputs: [{ name: "authority_", type: "address" }], name: "setAuthority", outputs: [], payable: false, stateMutability: "nonpayable", type: "function" },
  { constant: true, inputs: [], name: "owner", outputs: [{ name: "", type: "address" }], payable: false, stateMutability: "view", type: "function" },
  {
    constant: false,
    inputs: [{ name: "_cacheAddr", type: "address" }],
    name: "setCache",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  { constant: true, inputs: [], name: "authority", outputs: [{ name: "", type: "address" }], payable: false, stateMutability: "view", type: "function" },
  { inputs: [{ name: "_cacheAddr", type: "address" }], payable: false, stateMutability: "nonpayable", type: "constructor" },
  { payable: true, stateMutability: "payable", type: "fallback" },
  {
    anonymous: true,
    inputs: [
      { indexed: true, name: "sig", type: "bytes4" },
      { indexed: true, name: "guy", type: "address" },
      { indexed: true, name: "foo", type: "bytes32" },
      { indexed: true, name: "bar", type: "bytes32" },
      { indexed: false, name: "wad", type: "uint256" },
      { indexed: false, name: "fax", type: "bytes" },
    ],
    name: "LogNote",
    type: "event",
  },
  { anonymous: false, inputs: [{ indexed: true, name: "authority", type: "address" }], name: "LogSetAuthority", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "owner", type: "address" }], name: "LogSetOwner", type: "event" },
];

export async function isDefiSaverSmartWallet(address: string): Promise<boolean> {
  const DSProxyFactory_Address = "0xA26e15C895EFc0616177B7c1e7270A4C7D51C997";
  const web3HttpProvider = getWeb3HttpProvider();
  const DSProxyFactory = new web3HttpProvider.eth.Contract(DSProxyFactory_ABI, DSProxyFactory_Address);
  const res = await web3Call(DSProxyFactory, "isProxy", [address]);
  if (res === true) return true;
  return false;
}

const DSProxyFactory_ABI: AbiItem[] = [
  { constant: true, inputs: [{ name: "", type: "address" }], name: "isProxy", outputs: [{ name: "", type: "bool" }], payable: false, stateMutability: "view", type: "function" },
  { constant: true, inputs: [], name: "cache", outputs: [{ name: "", type: "address" }], payable: false, stateMutability: "view", type: "function" },
  { constant: false, inputs: [], name: "build", outputs: [{ name: "proxy", type: "address" }], payable: false, stateMutability: "nonpayable", type: "function" },
  {
    constant: false,
    inputs: [{ name: "owner", type: "address" }],
    name: "build",
    outputs: [{ name: "proxy", type: "address" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "proxy", type: "address" },
      { indexed: false, name: "cache", type: "address" },
    ],
    name: "Created",
    type: "event",
  },
];

export function generateDefiSaverUrl(address: string, collateralName: string): string {
  if (collateralName === "WETH") collateralName = "ETH";
  const baseUrl = `https://app.defisaver.com/curveUSD/smart-wallet/${collateralName}/manage`;
  const chainId = 1; // Assuming the chainId is always 1 for this URL structure
  return `${baseUrl}?trackAddress=${address}&chainId=${chainId}`;
}
