import { web3Call } from "../web3Calls/generic.js";

export function getVaultName(vaultAddress: string): string {
  const VAULT_wstETH_LONG_ADDRESS = "0xE21C518a09b26Bf65B16767B97249385f12780d9";
  const VAULT_CRV_LONG_ADDRESS = "0x67A18c18709C09D48000B321c6E1cb09F7181211";
  const VAULT_CRV_SHORT_ADDRESS = "0x044aC5160e5A04E09EBAE06D786fc151F2BA5ceD";

  const inputAddressLowerCase = vaultAddress.toLowerCase();

  if (inputAddressLowerCase === VAULT_wstETH_LONG_ADDRESS.toLowerCase()) {
    return "wstETH Long";
  } else if (inputAddressLowerCase === VAULT_CRV_LONG_ADDRESS.toLowerCase()) {
    return "CRV Long";
  } else if (inputAddressLowerCase === VAULT_CRV_SHORT_ADDRESS.toLowerCase()) {
    return "CRV Short";
  }

  return "Unknown Vault, dev?";
}

export async function getBorrowApr(contract: any, blockNumber: number) {
  const res = await web3Call(contract, "borrow_apr", [], blockNumber);
  return res / 1e16;
}

export async function getLendApr(contract: any, blockNumber: number) {
  const res = await web3Call(contract, "lend_apr", [], blockNumber);
  return res / 1e16;
}

export async function getTotalAssets(contract: any, blockNumber: number) {
  const res = await web3Call(contract, "totalAssets", [], blockNumber);
  return res / 1e18;
}

export async function getTotalDebtInMarket(contract: any, blockNumber: number) {
  const res = await web3Call(contract, "total_debt", [], blockNumber);
  return res / 1e18;
}

export async function getPositionHealth(contract: any, user: string, blockNumber: number) {
  const res = await web3Call(contract, "health", [user], blockNumber);
  return res / 1e16;
}

export async function getCollatDollarValue(contract: any, blockNumber: number) {
  const res = await web3Call(contract, "amm_price", [], blockNumber);
  return res / 1e18;
}

export async function getCollateralTokenAddress(contract: any) {
  const res = await web3Call(contract, "collateral_token", []);
  return res;
}
