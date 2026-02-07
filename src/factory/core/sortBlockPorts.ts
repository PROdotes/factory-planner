import { FactoryGraph } from "./FactoryGraph";
import { BlockBase } from "./BlockBase";
import { ProductionBlock } from "../blocks/ProductionBlock";
import { LogisticsBlock } from "../blocks/LogisticsBlock";
// We need access to Recipe definitions to know the "default" order
import { useGameDataStore } from "../../gamedata/gamedataStore";

/**
 * Reorders the input/output ports of a block based on the Y-position of connected neighbors.
 * This minimizes wire crossing.
 */
/**
 * Pure calculation: Returns the optimal input/output order.
 * Accepts an optional overrideY to simulate moving the block without committing state.
 * Accepts optional neighborOverrides to account for other blocks moving transiently.
 */
export function getSortedPorts(
  block: BlockBase,
  factory: FactoryGraph,
  overrideY?: number,
  neighborOverrides?: Map<string, { y: number }>
) {
  const { recipes } = useGameDataStore.getState();
  const currentY = overrideY ?? block.position.y;

  // 1. Identify all ports (items) the block supports
  let inputItems: string[] = [];
  let outputItems: string[] = [];

  const isProduction = block.type === "production";

  if (isProduction) {
    const prod = block as ProductionBlock;
    if (prod.recipeId) {
      const recipe = recipes[prod.recipeId];
      if (recipe) {
        // Default order from recipe
        inputItems = recipe.inputs.map((i) => i.itemId);
        outputItems = recipe.outputs.map((i) => i.itemId);
      }
    } else {
      // Stationary (Sink/Storage)
      inputItems = Object.keys(block.demand);
    }
  } else if (block instanceof LogisticsBlock) {
    // HOLISTIC: A Junction's items are defined by its connections.
    const itemIds = new Set<string>();
    factory.connections.forEach((c) => {
      if (c.sourceBlockId === block.id || c.targetBlockId === block.id) {
        if (c.itemId !== "unknown") itemIds.add(c.itemId);
      }
    });

    if (itemIds.size > 0) {
      inputItems = Array.from(itemIds);
      outputItems = Array.from(itemIds);
    } else {
      // Fallback for blank junctions
      const fallback =
        Object.keys(block.demand).find((k) => k !== "unknown") || "unknown";
      inputItems = [fallback];
      outputItems = [fallback];
    }
  }

  // Helper to get average Y of connected partners for a specific item on a specific side
  const getAverageConnectedY = (
    itemId: string,
    side: "input" | "output"
  ): number => {
    let totalY = 0;
    let count = 0;

    factory.connections.forEach((conn) => {
      if (
        side === "input" &&
        conn.targetBlockId === block.id &&
        conn.itemId === itemId
      ) {
        const srcId = conn.sourceBlockId;
        // Check overrides first
        if (neighborOverrides && neighborOverrides.has(srcId)) {
          totalY += neighborOverrides.get(srcId)!.y;
          count++;
        } else {
          const src = factory.blocks.get(srcId);
          if (src) {
            totalY += src.position.y;
            count++;
          }
        }
      }
      if (
        side === "output" &&
        conn.sourceBlockId === block.id &&
        conn.itemId === itemId
      ) {
        const tgtId = conn.targetBlockId;
        // Check overrides first
        if (neighborOverrides && neighborOverrides.has(tgtId)) {
          totalY += neighborOverrides.get(tgtId)!.y;
          count++;
        } else {
          const tgt = factory.blocks.get(tgtId);
          if (tgt) {
            totalY += tgt.position.y;
            count++;
          }
        }
      }
    });

    if (count === 0) return currentY; // Default to self level (potentially dynamic) if unconnected
    return totalY / count;
  };

  // 2. Sort Inputs
  // stability trick: add original index as a decimal to preserve relative order of ties
  const sortedInputs = [...inputItems].sort((a, b) => {
    const yA = getAverageConnectedY(a, "input");
    const yB = getAverageConnectedY(b, "input");

    // If both are unconnected (equal to block.y), preserve original recipe order
    if (Math.abs(yA - yB) < 1) {
      return inputItems.indexOf(a) - inputItems.indexOf(b);
    }
    return yA - yB;
  });

  // 3. Sort Outputs
  const sortedOutputs = [...outputItems].sort((a, b) => {
    const yA = getAverageConnectedY(a, "output");
    const yB = getAverageConnectedY(b, "output");

    if (Math.abs(yA - yB) < 1) {
      return outputItems.indexOf(a) - outputItems.indexOf(b);
    }
    return yA - yB;
  });

  return { inputOrder: sortedInputs, outputOrder: sortedOutputs };
}

/**
 * Reorders the input/output ports of a block based on the Y-position of connected neighbors.
 * This minimizes wire crossing.
 */
export function sortBlockPorts(block: BlockBase, factory: FactoryGraph) {
  const { inputOrder, outputOrder } = getSortedPorts(block, factory);
  // 4. Apply to block state
  block.inputOrder = inputOrder;
  block.outputOrder = outputOrder;
}
