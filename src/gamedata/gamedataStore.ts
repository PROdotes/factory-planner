/**
 * ROLE: Game Data Store
 * PURPOSE: Loads and provides Dyson Sphere Program game data (items, recipes, machines).
 * RELATION: Provides the "Intelligence" source for the Flow Solver.
 */

import { create } from 'zustand';
import { z } from 'zod';
import { Recipe, Machine } from './gamedata.types';

// Zod schemas for validation
const RecipePortSchema = z.object({
    itemId: z.string(),
    amount: z.number(),
});

const RecipeSchema = z.object({
    id: z.string(),
    name: z.string(),
    machineId: z.string(),
    inputs: z.array(RecipePortSchema),
    outputs: z.array(RecipePortSchema),
    craftingTime: z.number(),
    category: z.string(),
});

const MachineSchema = z.object({
    id: z.string(),
    name: z.string(),
    speed: z.number(),
    consumption: z.number(),
    idleConsumption: z.number(),
});

const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    stackSize: z.number(),
    isFluid: z.boolean(),
    iconIndex: z.number(),
    gridIndex: z.number(),
});

const GameDataSchema = z.object({
    items: z.array(ItemSchema),
    recipes: z.array(RecipeSchema),
    machines: z.array(MachineSchema),
});

interface GameState {
    items: Record<string, z.infer<typeof ItemSchema>>;
    recipes: Record<string, Recipe>;
    machines: Record<string, Machine>;
    isLoaded: boolean;
    error: string | null;
    loadData: () => Promise<void>;
}

export const useGameDataStore = create<GameState>((set) => ({
    items: {},
    recipes: {},
    machines: {},
    isLoaded: false,
    error: null,

    loadData: async () => {
        try {
            const response = await fetch('/packs/dsp.json');
            const rawData = await response.json();

            // 1. Validate data with Zod
            const validatedData = GameDataSchema.parse(rawData);

            // 2. Index data for fast lookup
            const items: Record<string, any> = {};
            const recipes: Record<string, Recipe> = {};
            const machines: Record<string, Machine> = {};

            validatedData.items.forEach(i => items[i.id] = i);
            validatedData.recipes.forEach(r => recipes[r.id] = r);
            validatedData.machines.forEach(m => machines[m.id] = m);

            set({ items, recipes, machines, isLoaded: true, error: null });
        } catch (err) {
            console.error('Failed to load game data:', err);
            set({ error: (err as Error).message });
        }
    },
}));
