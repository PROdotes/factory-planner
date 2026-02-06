export interface SolverInputs {
    recipeId: string;
    targetRate: number; // For the primary output
    machineId: string;
    speedModifier: number; // Default 1.0
}

import { rateMultiplierForUnit } from '@/lib/rates';
import { GameSettings, Recipe, Machine } from '@/types/game';

/**
 * Calculates machine count and port rates for a single block.
 */
export function solveBlock(
    recipe: Recipe,
    machine: Machine,
    targetRate: number,
    speedModifier: number = 1.0,
    primaryOutputId?: string,
    productivityModifier: number = 0.0,
    targetMachineCount?: number,
    rateUnit: GameSettings['rateUnit'] = 'minute'
) {
    // 1. Determine which output drives the calculation
    const primaryOutput = primaryOutputId
        ? recipe.outputs.find(o => o.itemId === primaryOutputId) || recipe.outputs[0]
        : recipe.outputs[0];

    // Productivity affects output amount per craft
    const baseOutputAmount = primaryOutput.amount * (1 + productivityModifier);
    const rateMultiplier = rateMultiplierForUnit(rateUnit);
    const itemsPerSecondBase = baseOutputAmount / recipe.craftingTime;
    const itemsPerUnitBase = itemsPerSecondBase * rateMultiplier;

    // 2. Adjust for machine speed and speed modifiers (speedModifier is e.g. 1.25 for +25% speed)
    // Note: If speedModifier is passed as a multiplier (e.g. 1.0 is normal), usage is direct.
    const actualItemsPerUnitPerMachine = itemsPerUnitBase * machine.speed * speedModifier;

    // 3. Calculate machines needed to hit target rate OR use provided count
    let machineCount = targetMachineCount !== undefined ? targetMachineCount : (targetRate / actualItemsPerUnitPerMachine);

    if (targetRate === 0 && targetMachineCount === undefined) {
        machineCount = 1;
    }

    // 4. Calculate actual rates
    const inputRates = recipe.inputs.map(input => ({
        itemId: input.itemId,
        rate: (input.amount / recipe.craftingTime) * rateMultiplier * machine.speed * speedModifier * machineCount
    }));

    const outputRates = recipe.outputs.map(output => ({
        itemId: output.itemId,
        rate: (output.amount * (1 + productivityModifier) / recipe.craftingTime) * rateMultiplier * machine.speed * speedModifier * machineCount
    }));

    return {
        machineCount,
        actualRate: outputRates.find(r => r.itemId === primaryOutput.itemId)?.rate || outputRates[0].rate,
        inputRates,
        outputRates
    };
}
