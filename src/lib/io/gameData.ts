import { GameDefinition } from '@/types/game';
import { z } from 'zod';

// Zod schemas for runtime validation of imported data
const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(['ore', 'ingot', 'component', 'product', 'science', 'fluid', 'other']),
    stackSize: z.number(),
    icon: z.string().optional(),
    isCustom: z.boolean().optional(),
    color: z.string().optional(),
});

const RecipePortSchema = z.object({
    itemId: z.string(),
    amount: z.number(),
    probability: z.number().optional(),
});

const RecipeSchema = z.object({
    id: z.string(),
    name: z.string(),
    machineId: z.string(),
    inputs: z.array(RecipePortSchema),
    outputs: z.array(RecipePortSchema),
    craftingTime: z.number(),
    category: z.enum(['smelting', 'assembling', 'refining', 'chemical', 'research', 'mining', 'other']),
    isCustom: z.boolean().optional(),
    notes: z.string().optional(),
});

const MachineSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(['smelter', 'assembler', 'refinery', 'chemical', 'lab', 'miner', 'other']),
    speed: z.number(),
    size: z.object({
        width: z.number(),
        height: z.number(),
    }),
    powerUsage: z.number().optional(),
    icon: z.string().optional(),
    isCustom: z.boolean().optional(),
    allowedCategories: z.array(z.string()).optional(), // Loose check for categories
});

const BeltTierSchema = z.object({
    id: z.string(),
    name: z.string(),
    tier: z.number(),
    itemsPerSecond: z.number(),
    color: z.string(),
    icon: z.string().optional(),
});

const GameDefinitionSchema = z.object({
    id: z.enum(['dsp', 'factorio', 'satisfactory']),
    name: z.string(),
    version: z.string(),
    items: z.array(ItemSchema),
    recipes: z.array(RecipeSchema),
    machines: z.array(MachineSchema),
    belts: z.array(BeltTierSchema),
    settings: z.object({
        lanesPerBelt: z.number(),
        hasSpeedModifiers: z.boolean(),
        rateUnit: z.enum(['second', 'minute']),
        gridSize: z.number(),
        defaultMachineIds: z.record(z.string(), z.string()).optional(),
    }),
});

/**
 * Validate imported game data against the schema.
 * Returns the parsed data or throws an error.
 */
export function validateGameData(data: unknown): GameDefinition {
    return GameDefinitionSchema.parse(data) as GameDefinition; // Casting for complex enum types if methods match
}

export interface ImportResult {
    success: boolean;
    data?: GameDefinition;
    error?: string;
}

/**
 * Safe wrapper for importing game data.
 */
export function importGameData(jsonString: string): ImportResult {
    try {
        const raw = JSON.parse(jsonString);
        const data = validateGameData(raw);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown validation error' };
    }
}

/**
 * Export game data to JSON string.
 */
export function exportGameData(data: GameDefinition): string {
    return JSON.stringify(data, null, 2);
}
