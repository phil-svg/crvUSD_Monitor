import { getPriceOf_crvUSD, getPriceOf_crvUSD_2nd } from "../utils/priceAPI/priceAPI.js";
import ExcelJS from "exceljs";

export async function plotHistoPriceComparison(): Promise<void> {
  // 50 blocks = 10 minutes
  const eventBlock = 19066535;
  const before = 150;
  const after = 150;
  const startBlock = eventBlock - before;
  const numberOfBlocks = before + after;
  const dataForExcel = [];

  for (let i = 0; i < numberOfBlocks; i++) {
    console.log("\ni", i);
    const currentBlock = startBlock + i;
    try {
      const price = await getPriceOf_crvUSD(currentBlock);
      console.log("price", price);

      const price2nd = await getPriceOf_crvUSD_2nd(currentBlock);
      console.log("price2nd", price2nd);

      dataForExcel.push({
        blockNumber: currentBlock,
        price: price ?? "N/A",
        price2nd: price2nd ?? "N/A",
      });
    } catch (error) {
      console.error(`Error fetching data for block ${currentBlock}:`, error);
    }
  }

  // Write to Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Price Comparison");

  // Define columns
  worksheet.columns = [
    { header: "Block Number", key: "blockNumber", width: 15 },
    { header: "Price (crvUSD) 0xe5Afcf...e7", key: "price", width: 20 },
    { header: "Price (crvUSD) 0x18672b...62", key: "price2nd", width: 20 },
  ];

  // Add rows
  worksheet.addRows(dataForExcel);

  // Write the file to the current directory
  try {
    await workbook.xlsx.writeFile("PriceComparison.xlsx");
    console.log("Excel file written successfully.");
  } catch (error) {
    console.error("Error writing Excel file:", error);
  }
}
