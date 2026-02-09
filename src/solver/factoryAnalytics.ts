import { FactoryGraph } from "../factory/core/FactoryGraph";
import { ProductionBlock } from "../factory/blocks/ProductionBlock";
import { GathererBlock } from "../factory/blocks/GathererBlock";
import { Recipe, Machine } from "../gamedata/gamedata.types";

export interface FactoryAnalytics {
  totalActivePower: number; // Watts (Net: Consumption - Generation)
  totalIdlePower: number; // Watts (Baseline Idle Draw)
  buildingCounts: Record<string, number>;
}

export function computeFactoryAnalytics(
  factory: FactoryGraph,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine>,
  windEfficiency: number = 1.0
): FactoryAnalytics {
  const analytics: FactoryAnalytics = {
    totalActivePower: 0,
    totalIdlePower: 0,
    buildingCounts: {},
  };

  factory.blocks.forEach((node) => {
    // We care about physical machines occupying space and drawing power.
    // This includes Assemblers, Smelters, Miners, Pumps, etc.
    if (node instanceof ProductionBlock || node instanceof GathererBlock) {
      let machine: Machine | null = null;
      let recipe: Recipe | null = null;

      // 1. Identify Machine
      if (node.machineId) {
        machine = machines[node.machineId];
      } else if (node instanceof ProductionBlock && node.recipeId) {
        recipe = recipes[node.recipeId];
        if (recipe) {
          machine = machines[recipe.machineId];
        }
      }

      if (!machine) return;

      // 2. Determine Physical Count
      // We use the configured machine count (User set or Solver calculated).
      // This represents the "Installed Capacity".
      const machineCount = node.machineCount || 0;
      if (machineCount === 0) return;

      // 3. Accumulate Stats: Use Physical Building Count (Ceil)
      const physicalCount = Math.ceil(machineCount);
      analytics.buildingCounts[machine.id] =
        (analytics.buildingCounts[machine.id] || 0) + physicalCount;

      if (machine.generation && machine.generation > 0) {
        // GENERATOR
        let generation = machine.generation;
        if (machine.id === "wind-turbine") {
          generation *= windEfficiency;
        }
        analytics.totalActivePower -= physicalCount * generation;
      } else {
        // CONSUMER: We use Physical Count for MAX Potential Consumption.
        analytics.totalActivePower +=
          physicalCount * (machine.consumption || 0);
        analytics.totalIdlePower +=
          physicalCount * (machine.idleConsumption || 0);
      }
    }
  });

  return analytics;
}
