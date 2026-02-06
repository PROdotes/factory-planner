/**
 * ROLE: Analytics Engine
 * PURPOSE: Computes aggregated metrics (Power, Building Counts) for the entire factory.
 */

import { FactoryGraph } from "../factory/core/FactoryGraph";
import { ProductionBlock } from "../factory/blocks/ProductionBlock";
import { Recipe, Machine } from "../gamedata/gamedata.types";

export interface FactoryAnalytics {
  totalActivePower: number; // Watts
  totalIdlePower: number; // Watts
  buildingCounts: Record<string, number>; // machineId -> count
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
    if (node instanceof ProductionBlock) {
      let machine: Machine | null = null;
      let recipe: Recipe | null = null;

      if (node.recipeId) {
        recipe = recipes[node.recipeId];
        if (recipe) {
          machine = machines[recipe.machineId];
        }
      } else if (node.machineId) {
        machine = machines[node.machineId];
      }

      if (!machine) return;

      // Determine effective machine count based on actual production
      // 1. Find the primary output flow (first output in recipe)
      // If no outputs (burner?), look at inputs? DSP recipes always have outputs usually.
      // Actually, we can just look at the 'satisfaction' results relative to the requested rate?

      // Better: Deduce from the first output's flow rate
      let calculatedMachines = 0;

      if (recipe && recipe.outputs.length > 0) {
        const primaryOut = recipe.outputs[0];
        const flowResult = node.results.flows[primaryOut.itemId];
        const flowRate = flowResult ? flowResult.actual : 0; // items/min

        // Recipe logic:
        // Base Rate = (Amount / Time) * 60
        // Machine Rate = Base Rate * MachineSpeed
        // Machines = FlowRate / MachineRate

        const baseItemsPerMin = (primaryOut.amount / recipe.craftingTime) * 60;
        const machineCapacity = baseItemsPerMin * machine.speed;

        if (machineCapacity > 0) {
          calculatedMachines = flowRate / machineCapacity;
        }
      } else {
        // If no recipe, use the machine count directly (e.g. Generators)
        calculatedMachines = node.machineCount;
      }

      // In Auto mode, the solver might return fractional satisfaction.
      // We usually build integer machines.
      const integerMachines = Math.ceil(calculatedMachines || 0);

      // Accumulate Buildings
      analytics.buildingCounts[machine.id] =
        (analytics.buildingCounts[machine.id] || 0) + integerMachines;

      // Accumulate Power
      // Active Power = Work Consumption * Machines (or -Generation * Machines)
      // Idle Power = Idle Consumption * Machines

      if (machine.generation && machine.generation > 0) {
        // It's a generator (Wind Turbine, Solar Panel)
        let generation = machine.generation;
        if (machine.id === "wind-turbine") {
          generation *= windEfficiency;
        }

        analytics.totalActivePower -= integerMachines * generation;
      } else {
        // It's a consumer
        analytics.totalActivePower += integerMachines * machine.consumption;
        analytics.totalIdlePower += integerMachines * machine.idleConsumption;
      }
    }
  });

  return analytics;
}
