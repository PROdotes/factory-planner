/**
 * ROLE: Solver Integration
 * PURPOSE: Bridges factoryStore with the flow rate solver.
 * RELATION: Wraps solveFlowRates with debouncing and mode handling.
 */

import { solveFlowRates } from "../solver/solveRates";
import { FactoryGraph } from "./core/FactoryGraph";
import { Recipe, Machine, Gatherer } from "../gamedata/gamedata.types";

interface FactoryState {
  factory: FactoryGraph;
  version: number;
  runSolver: () => void;
  saveToLocalStorage: () => void;
}

let solverTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Creates a debounced solver wrapper that delays execution by 300ms.
 * Useful for batching rapid changes (like dragging) into a single solve.
 */
export function createDebouncedSolver(
  getState: () => FactoryState
): () => void {
  return () => {
    if (solverTimeout) clearTimeout(solverTimeout);
    solverTimeout = setTimeout(() => {
      getState().runSolver();
      getState().saveToLocalStorage();
    }, 300);
  };
}

interface RecipeMap {
  [id: string]: Recipe;
}

interface MachineMap {
  [id: string]: Machine;
}

interface GathererMap {
  [id: string]: Gatherer;
}

/**
 * Runs the solver in Manual (Capacity-Driven) mode.
 * Preserves user-set requested values for production blocks.
 */
export function runManualSolver(
  factory: FactoryGraph,
  recipes: RecipeMap,
  machines: MachineMap,
  gatherers?: GathererMap
): void {
  // Use toDTO for fast object-level manipulation
  const layoutDTO = factory.toDTO();

  // Filter out connections for deleted blocks
  layoutDTO.connections = layoutDTO.connections.filter(
    (c: any) =>
      layoutDTO.blocks[c.sourceBlockId] && layoutDTO.blocks[c.targetBlockId]
  );

  // Preserve user-set requested values for PRODUCTION and GATHERER blocks
  const savedRequested = new Map<string, Record<string, number>>();
  Object.values(layoutDTO.blocks).forEach((block) => {
    if (block.type === "production" || block.type === "gatherer") {
      savedRequested.set(block.id, { ...(block.requested || {}) });
    }
  });

  console.log(
    `[SOLVER] Running Manual throughput calculation on ${
      Object.keys(layoutDTO.blocks).length
    } blocks...`
  );

  // Solve in Manual (Capacity-Driven) mode
  solveFlowRates(layoutDTO, recipes, machines, gatherers);

  // Restore user-set requested values
  savedRequested.forEach((requested, blockId) => {
    const block = layoutDTO.blocks[blockId];
    if (block) {
      block.requested = requested;
    }
  });

  // Update the domain model
  factory.syncFromDTO(layoutDTO);
}

/**
 * Runs the solver in Auto-Scale (Demand-Driven) mode.
 * Calculates ideal machine counts to meet downstream demand.
 */
export function runAutoScale(
  factory: FactoryGraph,
  recipes: RecipeMap,
  machines: MachineMap,
  gatherers?: GathererMap
): void {
  const layoutDTO = factory.toDTO();

  console.log("[SOLVER] Performing AUTO-SCALE...");

  // 1. Run a standard pass to ensure 'requested' demand is populated
  solveFlowRates(layoutDTO, recipes, machines, gatherers);

  // 2. Sync machineCount to match total required demand (requested)
  Object.values(layoutDTO.blocks).forEach((block) => {
    if (block.type === "production") {
      const b = block as any;
      if (!b.recipeId) return;

      const recipe = recipes[b.recipeId];
      if (!recipe) return;

      const machine = machines[recipe.machineId];
      if (!machine) return;

      const effectiveTime = recipe.craftingTime / (machine.speed || 1);

      let maxScale = 0;
      recipe.outputs.forEach((out) => {
        const demand = b.requested?.[out.itemId] || 0;
        const ratePerUnit = out.amount / effectiveTime;
        if (ratePerUnit > 0) {
          const scale = demand / ratePerUnit;
          if (scale > maxScale) maxScale = scale;
        }
      });

      (block as any).machineCount = maxScale;
    } else if (block.type === "gatherer") {
      const b = block as any;
      if (!b.gathererId || !gatherers) return;

      const gatherer = gatherers[b.gathererId];
      if (!gatherer) return;

      const machine = machines[gatherer.machineId];
      const speed = machine?.speed ?? 1.0;
      const ratePerVein = gatherer.extractionRate * speed;

      const demand = b.requested?.[gatherer.outputItemId] || 0;
      if (ratePerVein > 0) {
        // Scale veins to meet demand
        (block as any).sourceYield = demand / ratePerVein;
        (block as any).machineCount = 1; // Default to 1 miner for the patch
      }
    }
  });

  // 3. Update the domain model
  factory.syncFromDTO(layoutDTO);
}
