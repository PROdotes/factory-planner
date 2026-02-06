/**
 * ROLE: Game Data Store
 * PURPOSE: Loads and provides Dyson Sphere Program game data (items, recipes, machines).
 * RELATION: Provides the "Intelligence" source for the Flow Solver.
 */

import { create } from "zustand";
import { z } from "zod";
import { Recipe, Machine } from "./gamedata.types";

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
  speed: z.number().optional().default(1),
  consumption: z.number().optional().default(0),
  idleConsumption: z.number().optional().default(0),
  generation: z.number().optional(),
});

const GeneratorSchema = z.object({
  id: z.string(),
  name: z.string(), // Generators usually have a name field in the user's snippet
  generation: z.number(),
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
  generators: z.array(GeneratorSchema).optional().default([]),
});

interface GameState {
  items: Record<string, z.infer<typeof ItemSchema>>;
  recipes: Record<string, Recipe>;
  machines: Record<string, Machine>;
  generators: Record<string, any>; // genId -> data
  isLoaded: boolean;
  error: string | null;
  loadData: () => Promise<void>;
}

export const useGameDataStore = create<GameState>((set) => ({
  items: {},
  recipes: {},
  machines: {},
  generators: {},
  isLoaded: false,
  error: null,

  loadData: async () => {
    try {
      const response = await fetch("/packs/dsp.json");
      const rawData = await response.json();

      // 1. Validate data with Zod
      const validatedData = GameDataSchema.parse(rawData);

      // 2. Index data for fast lookup
      const items: Record<string, any> = {};
      const recipes: Record<string, Recipe> = {};
      const machines: Record<string, Machine> = {};
      const generators: Record<string, any> = {};

      validatedData.items.forEach((i) => (items[i.id] = i));
      validatedData.recipes.forEach((r) => (recipes[r.id] = r));
      validatedData.machines.forEach((m) => (machines[m.id] = m));

      // Populate generators and merge into machines for solver compatibility
      validatedData.generators.forEach((gen) => {
        generators[gen.id] = gen;
        machines[gen.id] = {
          id: gen.id,
          speed: 1,
          consumption: 0,
          idleConsumption: 0,
          generation: gen.generation,
        };
      });

      set({
        items,
        recipes,
        machines,
        generators,
        isLoaded: true,
        error: null,
      });
    } catch (err) {
      console.error("Failed to load game data:", err);
      set({ error: (err as Error).message });
    }
  },
}));
