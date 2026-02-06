import { GameDefinition } from '@/types/game';

interface ValidationIssue {
    type: 'error' | 'warning';
    message: string;
    entityId?: string;
}

/**
 * Validates the internal consistency of the game data.
 * e.g. Recipes using items that don't exist.
 */
export function checkGameDataConsistency(game: GameDefinition): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const itemIds = new Set(game.items.map(i => i.id));
    const machineIds = new Set(game.machines.map(m => m.id));

    // Check Recipes
    game.recipes.forEach(recipe => {
        // Check machine existence
        if (!machineIds.has(recipe.machineId)) {
            issues.push({
                type: 'error',
                message: `Recipe uses unknown machine '${recipe.machineId}'`,
                entityId: recipe.id,
            });
        }

        // Check Input Items
        recipe.inputs.forEach(input => {
            if (!itemIds.has(input.itemId)) {
                issues.push({
                    type: 'error',
                    message: `Recipe input uses unknown item '${input.itemId}'`,
                    entityId: recipe.id,
                });
            }
        });

        // Check Output Items
        recipe.outputs.forEach(output => {
            if (!itemIds.has(output.itemId)) {
                issues.push({
                    type: 'error',
                    message: `Recipe output uses unknown item '${output.itemId}'`,
                    entityId: recipe.id,
                });
            }
        });

        // Loop detection (basic: input == output)
        // Note: Some recipes might actually do this (enrichment?), but usually a warning is nice.
        const inputIds = new Set(recipe.inputs.map(i => i.itemId));
        const outputIds = new Set(recipe.outputs.map(i => i.itemId));
        const selfLoops = [...inputIds].filter(id => outputIds.has(id));

        if (selfLoops.length > 0) {
            issues.push({
                type: 'warning',
                message: `Recipe consumes and produces the same item: ${selfLoops.join(', ')}`,
                entityId: recipe.id,
            });
        }
    });

    return issues;
}
