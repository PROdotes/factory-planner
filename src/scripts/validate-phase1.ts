import { produce } from 'immer';
import { DSP_DATA } from '../data/dsp'; // Relative path to avoid alias issues in simple script
import { importGameData, exportGameData } from '../lib/io/gameData';
import { checkGameDataConsistency } from '../lib/validation/gameValidators';
import { GameDefinition, Item, Recipe } from '../types/game';

// Mock Store State (since we can't easily run Zustand hook outside React without some setup, 
// we'll just manipulate the data directly using a similar pattern to verify logic)

console.log("--- Starting Phase 1 Validation ---");

// 1. Load Default Data
console.log("1. Loading Default Data...");
let gameData: GameDefinition = { ...DSP_DATA };
console.log(`   Loaded ${gameData.items.length} items and ${gameData.recipes.length} recipes.`);

// 2. Edit/Add Item (Immutability check)
console.log("2. Adding Custom Item 'Unobtainium'...");
const newItem: Item = {
    id: "unobtainium",
    name: "Unobtainium",
    category: "ore",
    stackSize: 50,
    isCustom: true
};

gameData = produce(gameData, draft => {
    draft.items.push(newItem);
});
console.log(`   Item count now: ${gameData.items.length}`);

// 3. Add Custom Recipe
console.log("3. Adding Custom Recipe 'Unobtainium Smelting'...");
const newRecipe: Recipe = {
    id: "smelt-unobtainium",
    name: "Smelt Unobtainium",
    machineId: "arc-smelter",
    inputs: [{ itemId: "unobtainium", amount: 1 }],
    outputs: [{ itemId: "iron-ingot", amount: 1 }], // Transmutation!
    craftingTime: 2.0,
    category: "smelting",
    isCustom: true
};

gameData = produce(gameData, draft => {
    draft.recipes.push(newRecipe);
});

// 4. Validate Consistency
console.log("4. Running Consistency Checks...");
const issues = checkGameDataConsistency(gameData);
if (issues.length === 0) {
    console.log("   ✅ No consistency issues found.");
} else {
    console.log("   ⚠️ Found issues:", issues);
}

// 5. Test Export
console.log("5. Testing Export...");
const jsonOutput = exportGameData(gameData);
console.log(`   Exported JSON length: ${jsonOutput.length} chars`);

// 6. Test Import & Validation
console.log("6. Testing Import...");
const importResult = importGameData(jsonOutput);

if (importResult.success && importResult.data) {
    console.log("   ✅ Import successful!");
    console.log(`   Imported ${importResult.data.items.length} items.`);

    // Verify custom data persisted
    const loadedItem = importResult.data.items.find(i => i.id === 'unobtainium');
    if (loadedItem) {
        console.log("   ✅ Custom item 'Unobtainium' verified.");
    } else {
        console.error("   ❌ Custom item lost!");
    }
} else {
    console.error("   ❌ Import failed:", importResult.error);
}

console.log("--- Phase 1 Validation Complete ---");
