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
    primaryOutputId?: string
) {
    // 1. Determine which output drives the calculation
    // Default to the first output if no specific ID is provided or found
    const primaryOutput = primaryOutputId
        ? recipe.outputs.find(o => o.itemId === primaryOutputId) || recipe.outputs[0]
        : recipe.outputs[0];

    const baseOutputAmount = primaryOutput.amount;
    const itemsPerSecondBase = baseOutputAmount / recipe.craftingTime;
    const itemsPerMinuteBase = itemsPerSecondBase * 60;

    // 2. Adjust for machine speed and speed modifiers
    const actualItemsPerMinutePerMachine = itemsPerMinuteBase * machine.speed * speedModifier;

    // 3. Calculate machines needed to hit target rate
    // If targetRate is 0, we might want to default to 1 machine's output
    if (targetRate === 0) {
        return {
            machineCount: 1,
            actualRate: actualItemsPerMinutePerMachine,
            inputRates: recipe.inputs.map(input => ({
                itemId: input.itemId,
                rate: (input.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier
            })),
            outputRates: recipe.outputs.map(output => ({
                itemId: output.itemId,
                rate: (output.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier
            }))
        };
    }

    const machineCount = targetRate / actualItemsPerMinutePerMachine;

    // 4. Calculate actual rates (should match targetRate for primary output)
    const inputRates = recipe.inputs.map(input => ({
        itemId: input.itemId,
        rate: (input.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier * machineCount
    }));

    const outputRates = recipe.outputs.map(output => ({
        itemId: output.itemId,
        rate: (output.amount / recipe.craftingTime) * 60 * machine.speed * speedModifier * machineCount
    }));

    return {
        machineCount,
        actualRate: outputRates.find(r => r.itemId === primaryOutput.itemId)?.rate || outputRates[0].rate,
        inputRates,
        outputRates
    };
}
