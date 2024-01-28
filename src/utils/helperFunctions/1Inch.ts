import { ETH_ADDRESS } from "../Constants.js";
import { web3Call } from "../web3Calls/generic.js";
import { getTxWithLimiter, getWeb3HttpProvider } from "./Web3.js";
import { AbiItem } from "web3-utils";

const web3 = getWeb3HttpProvider();

// Swapper 0x3c11f6265ddec22f4d049dde480615735f451646
const abiSwap1Inch: AbiItem[] = [
  {
    inputs: [
      { internalType: "address", name: "admin", type: "address" },
      { internalType: "address", name: "registry", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "who", type: "address" },
      { indexed: false, internalType: "bytes4", name: "what", type: "bytes4" },
    ],
    name: "Authorized",
    type: "event",
  },
  { anonymous: false, inputs: [], name: "Executed", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "address", name: "account", type: "address" }], name: "Paused", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "smartVault", type: "address" }], name: "SmartVaultSet", type: "event" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "source", type: "uint256" },
      { indexed: false, internalType: "bool", name: "allowed", type: "bool" },
    ],
    name: "SourceSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "who", type: "address" },
      { indexed: false, internalType: "bytes4", name: "what", type: "bytes4" },
    ],
    name: "Unauthorized",
    type: "event",
  },
  { anonymous: false, inputs: [{ indexed: false, internalType: "address", name: "account", type: "address" }], name: "Unpaused", type: "event" },
  { inputs: [], name: "ANY_ADDRESS", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "NAMESPACE", outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "who", type: "address" },
      { internalType: "bytes4", name: "what", type: "bytes4" },
    ],
    name: "authorize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint8", name: "source", type: "uint8" },
      { internalType: "address", name: "tokenIn", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "minAmountOut", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "call",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  { inputs: [], name: "getAllowedSources", outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "who", type: "address" },
      { internalType: "bytes4", name: "what", type: "bytes4" },
    ],
    name: "isAuthorized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "source", type: "uint256" }],
    name: "isSourceAllowed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "pause", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "paused", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "registry", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "newSmartVault", type: "address" }], name: "setSmartVault", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "source", type: "uint256" },
      { internalType: "bool", name: "allowed", type: "bool" },
    ],
    name: "setSource",
    outputs: [{ internalType: "bool", name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  { inputs: [], name: "smartVault", outputs: [{ internalType: "contract ISmartVault", name: "", type: "address" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "who", type: "address" },
      { internalType: "bytes4", name: "what", type: "bytes4" },
    ],
    name: "unauthorize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  { inputs: [], name: "unpause", outputs: [], stateMutability: "nonpayable", type: "function" },
];

const abi1inchV5: AbiItem[] = [
  { inputs: [{ internalType: "contract IWETH", name: "weth", type: "address" }], stateMutability: "nonpayable", type: "constructor" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "maker", type: "address" },
      { indexed: false, internalType: "uint256", name: "newNonce", type: "uint256" },
    ],
    name: "NonceIncreased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "maker", type: "address" },
      { indexed: false, internalType: "bytes32", name: "orderHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "remainingRaw", type: "uint256" },
    ],
    name: "OrderCanceled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "maker", type: "address" },
      { indexed: false, internalType: "bytes32", name: "orderHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "remaining", type: "uint256" },
    ],
    name: "OrderFilled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes32", name: "orderHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "makingAmount", type: "uint256" },
    ],
    name: "OrderFilledRFQ",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "previousOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  { inputs: [{ internalType: "uint8", name: "amount", type: "uint8" }], name: "advanceNonce", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "offsets", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "and",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "arbitraryStaticCall",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order",
        type: "tuple",
      },
    ],
    name: "cancelOrder",
    outputs: [
      { internalType: "uint256", name: "orderRemaining", type: "uint256" },
      { internalType: "bytes32", name: "orderHash", type: "bytes32" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  { inputs: [{ internalType: "uint256", name: "orderInfo", type: "uint256" }], name: "cancelOrderRFQ", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "orderInfo", type: "uint256" },
      { internalType: "uint256", name: "additionalMask", type: "uint256" },
    ],
    name: "cancelOrderRFQ",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order",
        type: "tuple",
      },
    ],
    name: "checkPredicate",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "contract IClipperExchangeInterface", name: "clipperExchange", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "contract IERC20", name: "dstToken", type: "address" },
      { internalType: "uint256", name: "inputAmount", type: "uint256" },
      { internalType: "uint256", name: "outputAmount", type: "uint256" },
      { internalType: "uint256", name: "goodUntil", type: "uint256" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "vs", type: "bytes32" },
    ],
    name: "clipperSwap",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "contract IClipperExchangeInterface", name: "clipperExchange", type: "address" },
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "contract IERC20", name: "dstToken", type: "address" },
      { internalType: "uint256", name: "inputAmount", type: "uint256" },
      { internalType: "uint256", name: "outputAmount", type: "uint256" },
      { internalType: "uint256", name: "goodUntil", type: "uint256" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "vs", type: "bytes32" },
    ],
    name: "clipperSwapTo",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "contract IClipperExchangeInterface", name: "clipperExchange", type: "address" },
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "contract IERC20", name: "dstToken", type: "address" },
      { internalType: "uint256", name: "inputAmount", type: "uint256" },
      { internalType: "uint256", name: "outputAmount", type: "uint256" },
      { internalType: "uint256", name: "goodUntil", type: "uint256" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "vs", type: "bytes32" },
      { internalType: "bytes", name: "permit", type: "bytes" },
    ],
    name: "clipperSwapToWithPermit",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  { inputs: [], name: "destroy", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "eq",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "bytes", name: "interaction", type: "bytes" },
      { internalType: "uint256", name: "makingAmount", type: "uint256" },
      { internalType: "uint256", name: "takingAmount", type: "uint256" },
      { internalType: "uint256", name: "skipPermitAndThresholdAmount", type: "uint256" },
    ],
    name: "fillOrder",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes32", name: "", type: "bytes32" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "info", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
        ],
        internalType: "struct OrderRFQLib.OrderRFQ",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "uint256", name: "flagsAndAmount", type: "uint256" },
    ],
    name: "fillOrderRFQ",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes32", name: "", type: "bytes32" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "info", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
        ],
        internalType: "struct OrderRFQLib.OrderRFQ",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "vs", type: "bytes32" },
      { internalType: "uint256", name: "flagsAndAmount", type: "uint256" },
    ],
    name: "fillOrderRFQCompact",
    outputs: [
      { internalType: "uint256", name: "filledMakingAmount", type: "uint256" },
      { internalType: "uint256", name: "filledTakingAmount", type: "uint256" },
      { internalType: "bytes32", name: "orderHash", type: "bytes32" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "info", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
        ],
        internalType: "struct OrderRFQLib.OrderRFQ",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "uint256", name: "flagsAndAmount", type: "uint256" },
      { internalType: "address", name: "target", type: "address" },
    ],
    name: "fillOrderRFQTo",
    outputs: [
      { internalType: "uint256", name: "filledMakingAmount", type: "uint256" },
      { internalType: "uint256", name: "filledTakingAmount", type: "uint256" },
      { internalType: "bytes32", name: "orderHash", type: "bytes32" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "info", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
        ],
        internalType: "struct OrderRFQLib.OrderRFQ",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "uint256", name: "flagsAndAmount", type: "uint256" },
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes", name: "permit", type: "bytes" },
    ],
    name: "fillOrderRFQToWithPermit",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes32", name: "", type: "bytes32" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order_",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "bytes", name: "interaction", type: "bytes" },
      { internalType: "uint256", name: "makingAmount", type: "uint256" },
      { internalType: "uint256", name: "takingAmount", type: "uint256" },
      { internalType: "uint256", name: "skipPermitAndThresholdAmount", type: "uint256" },
      { internalType: "address", name: "target", type: "address" },
    ],
    name: "fillOrderTo",
    outputs: [
      { internalType: "uint256", name: "actualMakingAmount", type: "uint256" },
      { internalType: "uint256", name: "actualTakingAmount", type: "uint256" },
      { internalType: "bytes32", name: "orderHash", type: "bytes32" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "bytes", name: "interaction", type: "bytes" },
      { internalType: "uint256", name: "makingAmount", type: "uint256" },
      { internalType: "uint256", name: "takingAmount", type: "uint256" },
      { internalType: "uint256", name: "skipPermitAndThresholdAmount", type: "uint256" },
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes", name: "permit", type: "bytes" },
    ],
    name: "fillOrderToWithPermit",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes32", name: "", type: "bytes32" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "gt",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "salt", type: "uint256" },
          { internalType: "address", name: "makerAsset", type: "address" },
          { internalType: "address", name: "takerAsset", type: "address" },
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "address", name: "allowedSender", type: "address" },
          { internalType: "uint256", name: "makingAmount", type: "uint256" },
          { internalType: "uint256", name: "takingAmount", type: "uint256" },
          { internalType: "uint256", name: "offsets", type: "uint256" },
          { internalType: "bytes", name: "interactions", type: "bytes" },
        ],
        internalType: "struct OrderLib.Order",
        name: "order",
        type: "tuple",
      },
    ],
    name: "hashOrder",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "increaseNonce", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "maker", type: "address" },
      { internalType: "uint256", name: "slot", type: "uint256" },
    ],
    name: "invalidatorForOrderRFQ",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "lt",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "nonce",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "makerAddress", type: "address" },
      { internalType: "uint256", name: "makerNonce", type: "uint256" },
    ],
    name: "nonceEquals",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offsets", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "or",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ internalType: "bytes32", name: "orderHash", type: "bytes32" }],
    name: "remaining",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "orderHash", type: "bytes32" }],
    name: "remainingRaw",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32[]", name: "orderHashes", type: "bytes32[]" }],
    name: "remainingsRaw",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "contract IERC20", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "rescueFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "simulate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "contract IAggregationExecutor", name: "executor", type: "address" },
      {
        components: [
          { internalType: "contract IERC20", name: "srcToken", type: "address" },
          { internalType: "contract IERC20", name: "dstToken", type: "address" },
          { internalType: "address payable", name: "srcReceiver", type: "address" },
          { internalType: "address payable", name: "dstReceiver", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "minReturnAmount", type: "uint256" },
          { internalType: "uint256", name: "flags", type: "uint256" },
        ],
        internalType: "struct GenericRouter.SwapDescription",
        name: "desc",
        type: "tuple",
      },
      { internalType: "bytes", name: "permit", type: "bytes" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "swap",
    outputs: [
      { internalType: "uint256", name: "returnAmount", type: "uint256" },
      { internalType: "uint256", name: "spentAmount", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "time", type: "uint256" }],
    name: "timestampBelow",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "timeNonceAccount", type: "uint256" }],
    name: "timestampBelowAndNonceEquals",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
    ],
    name: "uniswapV3Swap",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "int256", name: "amount0Delta", type: "int256" },
      { internalType: "int256", name: "amount1Delta", type: "int256" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    name: "uniswapV3SwapCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
    ],
    name: "uniswapV3SwapTo",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
      { internalType: "bytes", name: "permit", type: "bytes" },
    ],
    name: "uniswapV3SwapToWithPermit",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
    ],
    name: "unoswap",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
    ],
    name: "unoswapTo",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "contract IERC20", name: "srcToken", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "minReturn", type: "uint256" },
      { internalType: "uint256[]", name: "pools", type: "uint256[]" },
      { internalType: "bytes", name: "permit", type: "bytes" },
    ],
    name: "unoswapToWithPermit",
    outputs: [{ internalType: "uint256", name: "returnAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  { stateMutability: "payable", type: "receive" },
];

interface IParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
}

export async function decode1Inch(tx: any): Promise<IParams | null> {
  // get method signature from input data
  const methodSignature = tx.input.slice(0, 10);

  // find corresponding method in abi
  const methodAbi = abiSwap1Inch.find((abiItem: AbiItem) => web3.eth.abi.encodeFunctionSignature(abiItem) === methodSignature);

  if (methodAbi) {
    // decode parameters
    const decodedParams = web3.eth.abi.decodeParameters(methodAbi.inputs!, "0x" + tx.input.slice(10));

    // map decoded parameters to property names
    const params: IParams = {
      tokenIn: decodedParams[1],
      tokenOut: decodedParams[2],
      amountIn: decodedParams[3],
      minAmountOut: decodedParams[4],
    };

    return params;
  } else {
    return null;
  }
}

export async function decode1InchV5(tx: any): Promise<IParams | null> {
  // get method signature from input data
  const methodSignature = tx.input.slice(0, 10);

  console.log("tx", tx);

  // find corresponding method in abi
  const methodAbi = abi1inchV5.find((abiItem: AbiItem) => web3.eth.abi.encodeFunctionSignature(abiItem) === methodSignature);

  if (methodAbi) {
    // decode parameters
    const decodedParams = web3.eth.abi.decodeParameters(methodAbi.inputs!, "0x" + tx.input.slice(10));

    // map decoded parameters to property names
    const params: IParams = {
      tokenIn: decodedParams.desc.srcToken,
      tokenOut: decodedParams.desc.dstToken,
      amountIn: decodedParams.desc.amount,
      minAmountOut: decodedParams.desc.minReturnAmount,
    };

    return params;
  } else {
    return null;
  }
}

interface ITokenInfo {
  tokenInName: string;
  tokenOutName: string;
  amountIn: number;
  minReturnAmount: number;
}

async function getTokenNameFromChain(address: string): Promise<string> {
  if (address.toLowerCase() === ETH_ADDRESS.toLowerCase()) return "ETH";
  let ABI_SYMBOL: AbiItem[] = [{ stateMutability: "view", type: "function", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }] }];
  const web3HTTP = getWeb3HttpProvider();
  let CONTRACT = new web3HTTP.eth.Contract(ABI_SYMBOL, address);
  let name = await web3Call(CONTRACT, "symbol", []);
  if (typeof name !== "string") return "token";
  return name;
}

async function getTokenDecimalsFromChain(address: string): Promise<number> {
  if (address.toLowerCase() === ETH_ADDRESS.toLowerCase()) return 18;

  let ABI_DECIMALS: AbiItem[] = [
    { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint256" }], payable: false, stateMutability: "view", type: "function" },
  ];
  const web3HTTP = getWeb3HttpProvider();
  let CONTRACT = new web3HTTP.eth.Contract(ABI_DECIMALS, address);
  let decimals = await web3Call(CONTRACT, "decimals", []);
  if (typeof decimals !== "string") return 18; // best guess in case of failed decimal fetch
  return parseInt(decimals);
}

export async function getSwap1InchMinAmountInfo(txHash: string): Promise<ITokenInfo> {
  const tx = await getTxWithLimiter(txHash);
  const decodedTx = await decode1Inch(tx);

  const tokenInName = await getTokenNameFromChain(decodedTx!.tokenIn);
  const tokenOutName = await getTokenNameFromChain(decodedTx!.tokenOut);

  const tokenInDecimals = await getTokenDecimalsFromChain(decodedTx!.tokenIn);
  let amountIn = Number(decodedTx!.amountIn);
  amountIn = amountIn / Math.pow(10, tokenInDecimals);

  const tokenOutDecimals = await getTokenDecimalsFromChain(decodedTx!.tokenOut);
  let minReturnAmount = Number(decodedTx!.minAmountOut);
  minReturnAmount = minReturnAmount / Math.pow(10, tokenOutDecimals);

  return {
    tokenInName,
    tokenOutName,
    amountIn,
    minReturnAmount,
  };
}

export async function get1InchV5MinAmountInfo(txHash: string): Promise<ITokenInfo> {
  const tx = await getTxWithLimiter(txHash);
  const decodedTx = await decode1InchV5(tx);

  const tokenInName = await getTokenNameFromChain(decodedTx!.tokenIn);
  const tokenOutName = await getTokenNameFromChain(decodedTx!.tokenOut);

  const tokenInDecimals = await getTokenDecimalsFromChain(decodedTx!.tokenIn);
  let amountIn = Number(decodedTx!.amountIn);
  amountIn = amountIn / Math.pow(10, tokenInDecimals);

  const tokenOutDecimals = await getTokenDecimalsFromChain(decodedTx!.tokenOut);
  let minReturnAmount = Number(decodedTx!.minAmountOut);
  minReturnAmount = minReturnAmount / Math.pow(10, tokenOutDecimals);

  return {
    tokenInName,
    tokenOutName,
    amountIn,
    minReturnAmount,
  };
}
