/**
 * ROLE: Data Schema (Game Layer)
 * PURPOSE: Definitions for Dyson Sphere Program items, recipes, and machines.
 */

export interface RecipePort {
  itemId: string;
  amount: number; // Items per craft cycle
}

export interface Recipe {
  id: string;
  name: string;
  machineId: string;
  inputs: RecipePort[];
  outputs: RecipePort[];
  craftingTime: number; // Seconds per craft
  category: string;
}

export interface Machine {
  id: string;
  speed: number; // Multiplier (1.0, 2.0, etc)
  consumption: number; // Active power in Watts
  idleConsumption: number; // Idle power in Watts
  generation?: number; // Power generated in Watts (e.g., Wind Turbine)
}
