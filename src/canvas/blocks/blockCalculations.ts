/**
 * ROLE: Utility Functions
 * PURPOSE: Calculates machine counts, rates, and power for block rendering.
 * RELATION: Used by BlockCard for display calculations.
 */

import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { GathererBlock } from "../../factory/blocks/GathererBlock";
import { BlockBase } from "../../factory/core/BlockBase";
import {
  Recipe,
  Machine,
  RecipePort,
  Gatherer,
} from "../../gamedata/gamedata.types";

export interface MachineMetrics {
  requiredMachineCount: number;
  targetRateUnitValue: number;
  isGenerator: boolean;
}

/**
 * Calculates machine count and target rate metrics for a production block.
 */
export function calculateMachineMetrics(
  block: BlockBase,
  recipe: Recipe | null,
  machine: Machine | null,
  isPerMin: boolean,
  gatherer?: Gatherer | null
): MachineMetrics {
  let requiredMachineCount = 0;
  let targetRateUnitValue = 0;
  const isGenerator =
    block instanceof ProductionBlock &&
    machine !== null &&
    !recipe &&
    !!machine.generation;

  if (block instanceof ProductionBlock && machine) {
    const mainOutput = recipe?.outputs[0];

    if (recipe && mainOutput) {
      const count = block.machineCount ?? 1.0;
      const ratePerMachine =
        (mainOutput.amount * machine.speed) / recipe.craftingTime;
      const targetRate = ratePerMachine * count;

      requiredMachineCount = count;
      targetRateUnitValue = isPerMin ? targetRate * 60 : targetRate;
    } else if (machine.generation) {
      // Generator block
      requiredMachineCount = block.machineCount;
      targetRateUnitValue = block.machineCount * machine.generation;
    }
  } else if (block instanceof GathererBlock && machine && gatherer) {
    const yieldMult = block.sourceYield ?? 1.0;
    const count = block.machineCount ?? 1.0;
    const targetRate = gatherer.extractionRate * machine.speed * yieldMult;

    requiredMachineCount = count;
    targetRateUnitValue = isPerMin ? targetRate * 60 : targetRate;
  }

  return { requiredMachineCount, targetRateUnitValue, isGenerator };
}

/**
 * Calculates power consumption in megawatts.
 */
export function calculatePowerMW(
  machine: Machine | null,
  machineCount: number
): number {
  if (!machine || machineCount <= 0) return 0;
  // Use Physical Count (Ceil) for power consumption calculation
  return (machine.consumption * Math.ceil(machineCount)) / 1000000;
}

/**
 * Formats power value for display (W, kW, or MW).
 */
export function formatPowerRate(watts: number): string {
  if (watts >= 1e6) return (watts / 1e6).toFixed(1) + "MW";
  if (watts >= 1e3) return (watts / 1e3).toFixed(1) + "kW";
  return watts.toFixed(0) + "W";
}

export interface FooterMetrics {
  actual: number;
  denom: number;
  capacity: number;
  efficiency: number;
}

/**
 * Calculates footer metrics (actual rate, target rate, capacity, efficiency).
 */
export function calculateFooterMetrics(
  block: BlockBase,
  mainOutput: RecipePort | undefined,
  gatherer?: Gatherer | null
): FooterMetrics {
  // For gatherers, use the outputItemId
  const outputItemId = mainOutput?.itemId ?? gatherer?.outputItemId;
  const primaryFlow = outputItemId
    ? block.results?.flows?.[outputItemId]
    : null;

  const actual = primaryFlow?.sent ?? 0;
  const denom = primaryFlow?.demand ?? 0;
  const capacity = primaryFlow?.capacity ?? 0;
  const efficiency = denom > 0 ? actual / denom : block.satisfaction;

  return { actual, denom, capacity, efficiency };
}
