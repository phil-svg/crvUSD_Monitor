import fs from "fs";
import { getTokenDecimals, getTokenSymbol } from "./profit/profit.js";
export async function updateCheatSheet(collateralAddress) {
    const cheatSheetPath = "../CollateralCheatSheet.json";
    let cheatSheet;
    try {
        cheatSheet = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8"));
    }
    catch (err) {
        if (err.code === "ENOENT") {
            cheatSheet = [];
        }
        else {
            throw err; // If some other error occurred, rethrow it
        }
    }
    let tokenInfo = cheatSheet.find((token) => token.address.toLowerCase() === collateralAddress.toLowerCase());
    if (!tokenInfo) {
        const symbol = await getTokenSymbol(collateralAddress);
        if (!symbol)
            return;
        const decimals = await getTokenDecimals(collateralAddress);
        if (!decimals)
            return;
        cheatSheet.push({
            address: collateralAddress,
            symbol: symbol,
            decimals: decimals,
        });
        fs.writeFileSync(cheatSheetPath, JSON.stringify(cheatSheet, null, 2));
    }
}
export function getDecimalFromCheatSheet(address) {
    const cheatSheetPath = "../CollateralCheatSheet.json";
    const cheatSheet = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8")) || [];
    const tokenInfo = cheatSheet.find((token) => token.address.toLowerCase() === address.toLowerCase());
    if (tokenInfo) {
        return tokenInfo.decimals;
    }
    else {
        throw new Error(`Token with address ${address} not found in cheat sheet`);
    }
}
export function getSymbolFromCheatSheet(address) {
    const cheatSheetPath = "../CollateralCheatSheet.json";
    const cheatSheet = JSON.parse(fs.readFileSync(cheatSheetPath, "utf8")) || [];
    const tokenInfo = cheatSheet.find((token) => token.address.toLowerCase() === address.toLowerCase());
    if (tokenInfo) {
        return tokenInfo.symbol;
    }
    else {
        throw new Error(`Token with address ${address} not found in cheat sheet`);
    }
}
//# sourceMappingURL=CollatCheatSheet.js.map