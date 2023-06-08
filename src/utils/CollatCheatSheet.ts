import fs from "fs";
import { getTokenDecimals, getTokenSymbol } from "./profit/profit.js";

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export async function updateCheatSheet(collateralAddress: string): Promise<void> {
  const cheatSheetPath = "../CollateralCheatSheet.json";
  let cheatSheet: TokenInfo[];

  try {
    cheatSheet = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8"));
  } catch (err: any) {
    if (err.code === "ENOENT") {
      cheatSheet = [];
    } else {
      throw err; // If some other error occurred, rethrow it
    }
  }

  let tokenInfo = cheatSheet.find((token: TokenInfo) => token.address.toLowerCase() === collateralAddress.toLowerCase());

  if (!tokenInfo) {
    const symbol = await getTokenSymbol(collateralAddress);
    if (!symbol) return;

    const decimals = await getTokenDecimals(collateralAddress);
    if (!decimals) return;

    cheatSheet.push({
      address: collateralAddress,
      symbol: symbol,
      decimals: decimals,
    });

    fs.writeFileSync(cheatSheetPath, JSON.stringify(cheatSheet, null, 2));
  }
}

export function getDecimalFromCheatSheet(address: string): number {
  const cheatSheetPath = "../CollateralCheatSheet.json";
  const cheatSheet: TokenInfo[] = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8")) || [];

  const tokenInfo = cheatSheet.find((token: TokenInfo) => token.address.toLowerCase() === address.toLowerCase());

  if (tokenInfo) {
    return tokenInfo.decimals;
  } else {
    throw new Error(`Token with address ${address} not found in cheat sheet`);
  }
}

export function getSymbolFromCheatSheet(address: string): string {
  const cheatSheetPath = "../CollateralCheatSheet.json";
  const cheatSheet: TokenInfo[] = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8")) || [];

  const tokenInfo = cheatSheet.find((token: TokenInfo) => token.address.toLowerCase() === address.toLowerCase());

  if (tokenInfo) {
    return tokenInfo.symbol;
  } else {
    throw new Error(`Token with address ${address} not found in cheat sheet`);
  }
}
