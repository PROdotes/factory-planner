/**
 * ROLE: Data Transformation
 * PURPOSE: Collects and structures I/O items for block display.
 * RELATION: Transforms block data for BlockIORows component.
 */

import { BlockBase } from "../../factory/core/BlockBase";
import { Recipe, Gatherer } from "../../gamedata/gamedata.types";

export interface IOItem {
  itemId: string;
  name: string;
  actual: number;
  target: number;
}

interface ItemMap {
  [id: string]: { name: string } | undefined;
}

/**
 * Collects input items for display.
 * For sinks: uses demand directly.
 * For production blocks: uses recipe inputs with flow data.
 * Gatherers have no inputs.
 *
 * Shows "actual/target" where:
 * - actual = supply received
 * - target = min(machineCapacity, demandForFactoryMax)
 */
export function collectInputItems(
  block: BlockBase,
  recipe: Recipe | null,
  items: ItemMap,
  _gatherer?: Gatherer | null
): IOItem[] {
  // Gatherers have no inputs (they extract from the ground)
  if (block.type === "gatherer") return [];

  const isStationary = block.type === "production" && !recipe;
  if (isStationary) {
    return Object.keys(block.demand).map((id) => ({
      itemId: id,
      name: items[id]?.name || id,
      actual: block.supply[id] || 0,
      target: block.demand[id] || 0,
    }));
  }

  if (!recipe) return [];

  return recipe.inputs.map((input) => {
    const flow = block.results?.flows?.[input.itemId];
    // capacity = what machines can consume at full machineCount
    // block.demand = input needed for factory max (from backward pass)
    const machineCapacity = flow?.capacity ?? (block.demand[input.itemId] || 0);
    const demandForFactoryMax = block.demand[input.itemId] || 0;
    const workingTarget = Math.min(machineCapacity, demandForFactoryMax);

    return {
      itemId: input.itemId,
      name: items[input.itemId]?.name || input.itemId,
      actual: block.supply[input.itemId] || 0,
      target: workingTarget,
    };
  });
}

/**
 * Collects output items for display.
 *
 * Shows "actual/target" where:
 * - actual = sent (what actually left the block, gated by downstream)
 * - target = min(machineCapacity, factoryMax)
 */
export function collectOutputItems(
  block: BlockBase,
  recipe: Recipe | null,
  items: ItemMap,
  gatherer?: Gatherer | null
): IOItem[] {
  // Handle gatherer outputs
  if (gatherer) {
    const itemId = gatherer.outputItemId;
    const flow = block.results?.flows?.[itemId];
    const factoryMax = flow?.demand ?? (block.output[itemId] || 0);
    const machineCapacity = flow?.capacity ?? factoryMax;
    const workingTarget = Math.min(machineCapacity, factoryMax);

    return [
      {
        itemId,
        name: items[itemId]?.name || itemId,
        actual: flow?.sent ?? (block.output[itemId] || 0),
        target: workingTarget,
      },
    ];
  }

  if (!recipe) return [];

  return recipe.outputs.map((output) => {
    const flow = block.results?.flows?.[output.itemId];
    const factoryMax = flow?.demand ?? (block.output[output.itemId] || 0);
    const machineCapacity = flow?.capacity ?? factoryMax;
    const workingTarget = Math.min(machineCapacity, factoryMax);

    return {
      itemId: output.itemId,
      name: items[output.itemId]?.name || output.itemId,
      actual: flow?.sent ?? (block.output[output.itemId] || 0),
      target: workingTarget,
    };
  });
}
