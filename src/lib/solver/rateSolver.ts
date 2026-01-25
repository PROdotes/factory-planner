export interface SolverInputs {
    recipeId: string;
    targetRate: number; // For the primary output
    machineId: string;
    speedModifier: number; // Default 1.0
}

import { Recipe, Machine } from '@/types/game';

/**
 * Calculates machine count and port rates for a single block.
 */
export function solveBlock(
    recipe: Recipe,
    machine: Machine,
    targetRate: number,
    speedModifier: number = 1.0,
    primaryOutputId?: string,
    productivityModifier: number = 0.0
) {
    // 1. Determine which output drives the calculation
    const primaryOutput = primaryOutputId
        ? recipe.outputs.find(o => o.itemId === primaryOutputId) || recipe.outputs[0]
        : recipe.outputs[0];

    // Productivity affects output amount per craft
    const baseOutputAmount = primaryOutput.amount * (1 + productivityModifier);
    const itemsPerSecondBase = baseOutputAmount / recipe.craftingTime;
    const itemsPerMinuteBase = itemsPerSecondBase * 60;

    // 2. Adjust for machine speed and speed modifiers (speedModifier is e.g. 1.25 for +25% speed)
    // Note: If speedModifier is passed as a multiplier (e.g. 1.0 is normal), usage is direct.
    const actualItemsPerMinutePerMachine = itemsPerMinuteBase * machine.speed * speedModifier;

    // 3. Calculate machines needed to hit target rate
    if (targetRate === 0) {
        return {
            machineCount: 1,
            actualRate: actualItemsPerMinutePerMachine,
            inputRates: recipe.inputs.map(input => ({
                itemId: input.itemId,
                // Input consumption is NOT affected by productivity multiplier on output
                // But it IS affected by machine speed
                rate: (input.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier
            })),
            outputRates: recipe.outputs.map(output => ({
                itemId: output.itemId,
                // Output IS affected by productivity
                rate: (output.amount * (1 + productivityModifier) / recipe.craftingTime) * 60 * machine.speed * speedModifier
            }))
        };
    }

    const machineCount = targetRate / actualItemsPerMinutePerMachine;

    // 4. Calculate actual rates
    const inputRates = recipe.inputs.map(input => ({
        itemId: input.itemId,
        rate: (input.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier * machineCount
    }));

    const outputRates = recipe.outputs.map(output => ({
        itemId: output.itemId,
        rate: (output.amount * (1 + productivityModifier) / recipe.craftingTime) * 60 * machine.speed * speedModifier * machineCount
    }));

    return {
        machineCount,
        actualRate: outputRates.find(r => r.itemId === primaryOutput.itemId)?.rate || outputRates[0].rate,
        inputRates,
        outputRates
    };
}
