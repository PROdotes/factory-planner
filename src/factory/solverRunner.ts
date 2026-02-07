/**
 * ROLE: Solver Integration
 * PURPOSE: Bridges factoryStore with the flow rate solver.
 * RELATION: Wraps solveFlowRates with debouncing and mode handling.
 */

import { solveFlowRates } from "../solver/solveRates";
import { FactoryGraph } from "./core/FactoryGraph";
import { Recipe, Machine } from "../gamedata/gamedata.types";

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

/**
 * Runs the solver in Manual (Capacity-Driven) mode.
 * Preserves user-set requested values for production blocks.
 */
export function runManualSolver(
  factory: FactoryGraph,
  recipes: RecipeMap,
  machines: MachineMap
): void {
  // Use toDTO for fast object-level manipulation
  const layoutDTO = factory.toDTO();

  // Filter out connections for deleted blocks
  layoutDTO.connections = layoutDTO.connections.filter(
    (c: any) =>
      layoutDTO.blocks[c.sourceBlockId] && layoutDTO.blocks[c.targetBlockId]
  );

  // Preserve user-set requested values for PRODUCTION blocks
  const savedRequested = new Map<string, Record<string, number>>();
  Object.values(layoutDTO.blocks).forEach((block) => {
    if (block.type === "block") {
      savedRequested.set(block.id, { ...(block.requested || {}) });
    }
  });

  console.log(
    `[SOLVER] Running Manual throughput calculation on ${
      Object.keys(layoutDTO.blocks).length
    } blocks...`
  );

  // Solve in Manual (Capacity-Driven) mode
  solveFlowRates(layoutDTO, recipes, machines);

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
  machines: MachineMap
): void {
  const layoutDTO = factory.toDTO();

  console.log("[SOLVER] Performing AUTO-SCALE...");

  // 1. Run solver in Auto Mode by temporarily removing machine counts
  Object.values(layoutDTO.blocks).forEach((block) => {
    if (block.type === "block") {
      (block as any).machineCount = undefined;
    }
  });

  solveFlowRates(layoutDTO, recipes, machines, true);

  // 2. Sync machineCount to match required output
  Object.values(layoutDTO.blocks).forEach((block) => {
    if (block.type === "block") {
      const recipeId = (block as any).recipeId;
      if (recipeId) {
        const recipe = recipes[recipeId];
        const machine = recipe ? machines[recipe.machineId] : null;
        const mainOutput = recipe?.outputs[0];
        if (recipe && machine && mainOutput) {
          const yieldMult =
            recipe.category === "Gathering"
              ? (block as any).sourceYield ?? 1.0
              : 1.0;
          const ratePerMachine =
            ((mainOutput.amount * machine.speed) / recipe.craftingTime) *
            yieldMult;
          const requiredRate = block.requested?.[mainOutput.itemId] || 0;
          if (ratePerMachine > 0) {
            (block as any).machineCount = Math.ceil(
              requiredRate / ratePerMachine - 0.001
            );
          }
        }
      }
    }
  });

  // 3. Update the domain model
  factory.syncFromDTO(layoutDTO);
}
