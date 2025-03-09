import { ABI_AMM } from '../utils/abis/ABI_AMM.js';
import { ABI_Controller } from '../utils/abis/ABI_Controller.js';
import fs from 'fs';
import { getPastEvents, getPastEventsExtended, web3Call, web3HttpProvider } from '../utils/web3/Web3Basics.js';
async function getLiquidatedUsers(controllerAddress, startBlock, endBlock) {
    const controllerContract = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
    let users = [];
    const events = await getPastEvents(controllerContract, 'Liquidate', startBlock, endBlock);
    for (const event of events) {
        const blockNumber = event.blockNumber;
        const user = event.returnValues.user;
        users.push({
            address: user,
            blockNumber: blockNumber,
        });
    }
    // Create a map to track frequency of each user
    const userFrequency = new Map();
    // Count occurrences of each user
    for (const user of users) {
        userFrequency.set(user.address, (userFrequency.get(user.address) || 0) + 1);
    }
    // Filter out users that appear more than once
    const uniqueUsers = users.filter((user) => userFrequency.get(user.address) === 1);
    return uniqueUsers;
}
async function getPositionEffectingEvents(controllerAddress, startBlock, endBlock) {
    const controllerContract = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
    const repayEvents = await getPastEventsExtended(controllerContract, 'Repay', startBlock, endBlock);
    const borrowEvents = await getPastEventsExtended(controllerContract, 'Borrow', startBlock, endBlock);
    const removeCollateralEvents = await getPastEventsExtended(controllerContract, 'RemoveCollateral', startBlock, endBlock);
    return {
        repayEvents,
        borrowEvents,
        removeCollateralEvents,
    };
}
async function getLastInteractedBlockData(liquidatedUsers, positionEffectingEvents) {
    const result = [];
    for (const liquidatedUser of liquidatedUsers) {
        const userAddress = liquidatedUser.address.toLowerCase();
        const liquidationBlock = liquidatedUser.blockNumber;
        let lastInteractedBlock = 0;
        // Check repay events
        for (const event of positionEffectingEvents.repayEvents) {
            if (event.returnValues.user.toLowerCase() === userAddress) {
                if (event.blockNumber < liquidationBlock) {
                    lastInteractedBlock = Math.max(lastInteractedBlock, event.blockNumber);
                }
            }
        }
        // Check borrow events
        for (const event of positionEffectingEvents.borrowEvents) {
            if (event.returnValues.user.toLowerCase() === userAddress) {
                if (event.blockNumber < liquidationBlock) {
                    lastInteractedBlock = Math.max(lastInteractedBlock, event.blockNumber);
                }
            }
        }
        // Check remove collateral events
        for (const event of positionEffectingEvents.removeCollateralEvents) {
            if (event.returnValues.user.toLowerCase() === userAddress) {
                if (event.blockNumber < liquidationBlock) {
                    lastInteractedBlock = Math.max(lastInteractedBlock, event.blockNumber);
                }
            }
        }
        result.push({
            user: liquidatedUser.address,
            lastInteractedBlock,
            liquidatedAtBlock: liquidatedUser.blockNumber,
        });
    }
    return result;
}
async function handleMarket(market, startBlock, endBlock) {
    const controllerAddress = market.returnValues.controller;
    const ammAddress = market.returnValues.amm;
    // Positions that saw death:
    const liquidatedUsers = await getLiquidatedUsers(controllerAddress, startBlock, endBlock);
    console.log('liquidatedUsers', liquidatedUsers);
    console.log('Number of liquidated users:', liquidatedUsers.length);
    const positionEffectingEvents = await getPositionEffectingEvents(controllerAddress, startBlock, endBlock);
    const lastInteractedBlockJSON = await getLastInteractedBlockData(liquidatedUsers, positionEffectingEvents);
    console.log('lastInteractedBlockJSON', lastInteractedBlockJSON);
    // HEALTH
    // Store results as array
    const results = [];
    for (let userIndex = 0; userIndex < lastInteractedBlockJSON.length; userIndex++) {
        const userData = lastInteractedBlockJSON[userIndex];
        const user = userData.user;
        const liquidatedAtBlock = userData.liquidatedAtBlock;
        const lastInteractedBlock = userData.lastInteractedBlock;
        if (lastInteractedBlock === 0)
            continue;
        const blockRange = liquidatedAtBlock - lastInteractedBlock - 2;
        const numDays = Math.floor((blockRange * 12) / (60 * 60 * 24)); // Convert blocks to days (12 sec per block)
        const step = Math.floor(blockRange / numDays); // Divide by 4 to get 5 steps including start
        const ammContract = new web3HttpProvider.eth.Contract(ABI_AMM, ammAddress);
        const userTickNumbers = await web3Call(ammContract, 'read_user_tick_numbers', [user], lastInteractedBlock + 1);
        const [lowerTick, upperTick] = userTickNumbers.map(Number);
        const numBands = Math.abs(upperTick - lowerTick) + 1;
        for (let i = 0; i < numDays * 1; i++) {
            let blockNumber = lastInteractedBlock + step * i + 1;
            const conversionZonePriceRange = await getConversionZonePriceRange(controllerAddress, user, blockNumber);
            const is_in_sl = await getIfInSL(ammAddress, conversionZonePriceRange, blockNumber);
            let health = await getHealth(controllerAddress, user, is_in_sl, blockNumber);
            if (typeof health !== 'number')
                continue;
            health = Number(health.toFixed(2));
            const blocksTillDeath = liquidatedAtBlock - blockNumber;
            console.log(`User ${userIndex + 1}/${lastInteractedBlockJSON.length}:`, numDays, health, blocksTillDeath, numBands);
            results.push({
                health,
                blocksTillDeath,
                numBands,
            });
        }
    }
    console.log('results', results);
    // Write results to file
    fs.writeFileSync('liquidation-health-data.json', JSON.stringify(results, null, 2));
}
async function formatJSON() {
    // Load json
    const data = JSON.parse(fs.readFileSync('healthAndBands.json', 'utf8'));
    // Filter out negative health values and split by number of bands
    const bands4Data = data.filter((item) => item.health > 0 && item.numBands === 4);
    const bands10Data = data.filter((item) => item.health > 0 && item.numBands === 10);
    // Process data for 4 bands
    const healthByBlock4 = new Map();
    bands4Data.forEach((entry) => {
        var _a;
        const daysTillDeath = Number(((entry.blocksTillDeath * 12) / (60 * 60 * 24)).toFixed(2)); // Convert to days with 2 decimal places
        // Skip if more than 150 days
        if (daysTillDeath > 150)
            return;
        const dayKey = Math.floor(daysTillDeath * 100) / 100; // Round to 2 decimal places
        if (!healthByBlock4.has(dayKey)) {
            healthByBlock4.set(dayKey, []);
        }
        (_a = healthByBlock4.get(dayKey)) === null || _a === void 0 ? void 0 : _a.push(entry.health);
    });
    // Process data for 10 bands
    const healthByBlock10 = new Map();
    bands10Data.forEach((entry) => {
        var _a;
        const daysTillDeath = Number(((entry.blocksTillDeath * 12) / (60 * 60 * 24)).toFixed(2)); // Convert to days with 2 decimal places
        // Skip if more than 150 days
        if (daysTillDeath > 150)
            return;
        const dayKey = Math.floor(daysTillDeath * 100) / 100; // Round to 2 decimal places
        if (!healthByBlock10.has(dayKey)) {
            healthByBlock10.set(dayKey, []);
        }
        (_a = healthByBlock10.get(dayKey)) === null || _a === void 0 ? void 0 : _a.push(entry.health);
    });
    // Calculate averages for 4 bands
    const averaged4BandsData = Array.from(healthByBlock4.entries())
        .map(([daysTillDeath, healths]) => ({
        daysTillDeath,
        averageHealth: healths.reduce((sum, health) => sum + health, 0) / healths.length,
    }))
        .sort((a, b) => a.daysTillDeath - b.daysTillDeath);
    // Calculate averages for 10 bands
    const averaged10BandsData = Array.from(healthByBlock10.entries())
        .map(([daysTillDeath, healths]) => ({
        daysTillDeath,
        averageHealth: healths.reduce((sum, health) => sum + health, 0) / healths.length,
    }))
        .sort((a, b) => a.daysTillDeath - b.daysTillDeath);
    // Save averaged data to separate files
    fs.writeFileSync('4bandsAvg.json', JSON.stringify(averaged4BandsData, null, 2));
    fs.writeFileSync('10bandsAvg.json', JSON.stringify(averaged10BandsData, null, 2));
}
async function getConversionZonePriceRange(controllerAddress, user, blockNumber) {
    const controller = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
    const userPrices = await web3Call(controller, 'user_prices', [user], blockNumber);
    return userPrices;
}
async function getIfInSL(ammAddress, conversionZonePriceRange, blockNumber) {
    const amm = new web3HttpProvider.eth.Contract(ABI_AMM, ammAddress);
    const priceOracle = await web3Call(amm, 'price_oracle', [], blockNumber);
    const isInSl = Number(priceOracle) >= Number(conversionZonePriceRange[1]) &&
        Number(priceOracle) <= Number(conversionZonePriceRange[0]);
    return isInSl;
}
async function getHealth(controllerAddress, user, is_in_sl, blockNumber) {
    var _a, _b;
    try {
        const controller = new web3HttpProvider.eth.Contract(ABI_Controller, controllerAddress);
        let health = await web3Call(controller, 'health', [user, !is_in_sl], blockNumber);
        return Number(health) / 1e16;
    }
    catch (err) {
        if ((_b = (_a = err === null || err === void 0 ? void 0 : err.cause) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.includes('Loan doesn')) {
            return "Loan doesn't exist";
        }
        return null;
    }
}
async function handleMarketBands(market, startBlock, endBlock) {
    const controllerAddress = market.returnValues.controller;
    const ammAddress = market.returnValues.amm;
    // Positions that saw death:
    const liquidatedUsers = await getLiquidatedUsers(controllerAddress, startBlock, endBlock);
    console.log('liquidatedUsers', liquidatedUsers);
    console.log('Number of liquidated users:', liquidatedUsers.length);
    console.log('ammAddress', ammAddress);
    const ammContract = new web3HttpProvider.eth.Contract(ABI_AMM, ammAddress);
    // Track number of bands per user
    const bandCounts = {};
    for (const userData of liquidatedUsers) {
        const user = userData.address;
        const userTickNumbers = await web3Call(ammContract, 'read_user_tick_numbers', [user], userData.blockNumber - 200);
        console.log('userTickNumbers', userTickNumbers);
        // Calculate number of bands
        const [lowerTick, upperTick] = userTickNumbers.map(Number);
        const numBands = Math.abs(upperTick - lowerTick) + 1;
        // Increment count for this number of bands
        bandCounts[numBands] = (bandCounts[numBands] || 0) + 1;
    }
    // Write results to file
    console.log('bandCounts', bandCounts);
    fs.writeFileSync('band-counts.json', JSON.stringify(bandCounts, null, 2));
}
export async function checkLiveSpan() {
    console.time();
    // const startBlock = 21763078; // shallow
    const startBlock = 17562530; // deep
    const endBlock = 21781194;
    // REMOVES NEGATIVE HEALTHS FROM FILE
    // Read and filter data
    //   const data = JSON.parse(fs.readFileSync('liquidation-health-data.json', 'utf8'));
    //   const filteredData = data.filter((item: { health: number }) => item.health > 0);
    // Write filtered data back to file
    //fs.writeFileSync('liquidation-health-data.json', JSON.stringify(filteredData, null, 2));
    // FIND AVERAGE HEALTH PER DAYSTILLDEATH
    // const data = JSON.parse(fs.readFileSync('liquidation-health-data.json', 'utf8'));
    // Convert blocksTillDeath to daysTillDeath and bucket
    /*
    const healthByDay = new Map<number, number[]>();
  
    data.forEach((entry: { health: number; blocksTillDeath: number }) => {
      const daysTillDeath = Number(((entry.blocksTillDeath * 12) / (24 * 60 * 60)).toFixed(1)); // Convert blocks to days
      if (daysTillDeath <= 75) {
        // Only include entries with 150 days or less
        if (!healthByDay.has(daysTillDeath)) {
          healthByDay.set(daysTillDeath, []);
        }
        healthByDay.get(daysTillDeath)?.push(entry.health);
      }
    });
  
    // Calculate averages for each day bucket
    const averagedData = Array.from(healthByDay.entries())
      .map(([day, healths]) => ({
        daysTillDeath: day,
        averageHealth: healths.reduce((sum, health) => sum + health, 0) / healths.length,
      }))
      .sort((a, b) => a.daysTillDeath - b.daysTillDeath);
  
    fs.writeFileSync('averaged-health-by-dayFixed1cut75days.json', JSON.stringify(averagedData, null, 2));
    */
    // FETCH
    /*
    const crvUSD_LAUNCH_BLOCK = 17257955;
    const PRESENT = await getCurrentBlockNumber();
  
    const crvUSD_ControllerFactory = new WEB3_HTTP_PROVIDER.eth.Contract(
      ABI_crvUSD_ControllerFactory,
      ADDRESS_crvUSD_ControllerFactory
    );
  
    const ADDED_MARKET_EVENTS: any = await getPastEvents(
      crvUSD_ControllerFactory,
      'AddMarket',
      crvUSD_LAUNCH_BLOCK,
      PRESENT
    );
    for (const MARKET_CREATION of ADDED_MARKET_EVENTS) {
      const WETH = '0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635';
      if (MARKET_CREATION.returnValues.controller.toLowerCase() !== WETH.toLowerCase()) continue;
      // await handleMarket(MARKET_CREATION, startBlock, endBlock);
      await handleMarketBands(MARKET_CREATION, startBlock, endBlock);
    }
    */
    formatJSON();
    console.log('finished');
    console.timeEnd();
    process.exit();
}
/*
  const controllerAddress = '0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635';
  const ammAddress = '0x1681195C176239ac5E72d9aeBaCf5b2492E0C4ee';
  const user = '0x68884f0497f68113f5b69e677a8f803928bad139';
  const blockNumber = 21779980;
  const conversionZonePriceRange = await getConversionZonePriceRange(controllerAddress, user, blockNumber);
  const is_in_sl = await getIfInSL(ammAddress, conversionZonePriceRange, blockNumber);
  const health = await getHealth(controllerAddress, user, is_in_sl, blockNumber);
  console.log('health', health);

  // Repay: event.returnValues.user
  // Borrow: event.returnValues.user
  // RemoveCollateral: event.returnValues.user
*/
//# sourceMappingURL=LiveSpan.js.map