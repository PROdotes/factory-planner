/**
 * ROLE: Factory Domain Store
 * PURPOSE: Manages the logical production layout via the OOP FactoryGraph.
 * RELATION: Bridges the React UI to the Domain Models.
 */

import { create } from "zustand";
import { solveFlowRates } from "../solver/solveRates";
import { useGameDataStore } from "../gamedata/gamedataStore";
import { useUIStore } from "../canvas/uiStore";
import { FactoryGraph } from "./core/FactoryGraph";
import { StorageBlock } from "./blocks/StorageBlock";
import { ProductionBlock } from "./blocks/ProductionBlock";
import { LogisticsBlock } from "./blocks/LogisticsBlock";

interface FactoryState {
  // The Single Source of Truth for the Factory
  factory: FactoryGraph;
  version: number; // Increment to force re-renders
  selectedBlockId: string | null;

  // Actions
  addBlock: (name: string, x: number, y: number) => ProductionBlock;
  addSink: (name: string, x: number, y: number) => StorageBlock;
  addLogistics: (
    subtype: "splitter" | "merger" | "knot",
    x: number,
    y: number
  ) => LogisticsBlock;
  moveBlock: (id: string, x: number, y: number) => void;
  removeBlock: (id: string) => void;

  connect: (sourceId: string, targetId: string, itemId: string) => void;
  setRecipe: (blockId: string, recipeId: string | null) => void;
  setMachine: (blockId: string, machineId: string | null) => void;
  selectBlock: (id: string | null) => void;
  updateBlockName: (id: string, name: string) => void;
  setRequest: (blockId: string, itemId: string, rate: number) => void;
  setYield: (blockId: string, yieldValue: number) => void;
  setMachineCount: (blockId: string, count: number) => void;
  runSolver: () => void;
  loadDemo: () => void;
}

let solverTimeout: any = null;
const debouncedSolve = (get: any) => {
  if (solverTimeout) clearTimeout(solverTimeout);
  solverTimeout = setTimeout(() => {
    get().runSolver();
  }, 300);
};

export const useFactoryStore = create<FactoryState>((set, get) => ({
  factory: new FactoryGraph(),
  version: 0,
  selectedBlockId: null,

  addBlock: (name, x, y) => {
    const { factory } = get();
    const block = factory.addBlock(name, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return block;
  },

  addSink: (name, x, y) => {
    const { factory } = get();
    const sink = factory.addSink(name, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return sink;
  },

  addLogistics: (subtype, x, y) => {
    const { factory } = get();
    const block = factory.addLogistics(subtype, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return block;
  },

  moveBlock: (id, x, y) => {
    const { factory } = get();
    factory.moveBlock(id, x, y);
    set((state) => ({ version: state.version + 1 }));
  },

  removeBlock: (id) => {
    const { factory, selectedBlockId } = get();
    factory.removeBlock(id);
    set((state) => ({
      version: state.version + 1,
      selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
    }));
    debouncedSolve(get);
  },

  connect: (sourceId: string, targetId: string, itemId: string) => {
    const { factory } = get();
    factory.connect(sourceId, targetId, itemId);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
  },

  setRecipe: (blockId, recipeId) => {
    const { factory } = get();
    const { recipes } = useGameDataStore.getState();
    const block = factory.blocks.get(blockId);
    if (block && block instanceof ProductionBlock) {
      block.setRecipe(recipeId);
      // Auto-set machine from recipe
      if (recipeId) {
        const recipe = recipes[recipeId];
        if (recipe) {
          block.setMachine(recipe.machineId);
        }
      }
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  setMachine: (blockId, machineId) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (block && block instanceof ProductionBlock) {
      block.setMachine(machineId);
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  updateBlockName: (id, name) => {
    const { factory } = get();
    const block = factory.blocks.get(id);
    if (block) {
      block.name = name;
      set((state) => ({ version: state.version + 1 }));
    }
  },

  setRequest: (blockId, itemId, rate) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (!block) return;

    if (block instanceof StorageBlock) {
      block.setRequest(itemId, rate);
    } else if (block instanceof ProductionBlock) {
      // Production blocks can have targeted output goals
      block.requested[itemId] = rate;
    }

    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
  },

  setYield: (blockId, yieldValue) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (block) {
      block.sourceYield = yieldValue;
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  setMachineCount: (blockId, count) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (block instanceof ProductionBlock) {
      block.machineCount = count;
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  selectBlock: (id) => set({ selectedBlockId: id }),

  runSolver: () => {
    const { recipes, machines, isLoaded } = useGameDataStore.getState();
    if (!isLoaded) return;

    const { factory } = get();
    const { autoSolveEnabled } = useUIStore.getState();
    const layoutDTO = factory.toDTO();

    // If Auto Mode, we want the solver to be UNCONSTRAINED (ideal engineering)
    // If Manual Mode, we keep machineCount to analyze physical bottlenecks
    if (autoSolveEnabled) {
      Object.values(layoutDTO.blocks).forEach((block) => {
        if (block.type === "block") {
          delete (block as any).machineCount;
        }
      });
    }

    // In Manual mode, preserve user-set requested values for PRODUCTION blocks only
    const savedRequested = new Map<string, Record<string, number>>();
    if (!autoSolveEnabled) {
      Object.values(layoutDTO.blocks).forEach((block) => {
        // Only preserve for 'block' type (ProductionBlock), not 'sink' or 'logistics'
        if (block.type === "block") {
          savedRequested.set(block.id, { ...(block.requested || {}) });
        }
      });
    }

    console.log(
      `[SOLVER] Running iteration on ${
        Object.keys(layoutDTO.blocks).length
      } blocks... Mode: ${autoSolveEnabled ? "AUTO" : "MANUAL"}`
    );
    solveFlowRates(layoutDTO, recipes, machines);

    // Restore user-set requested values in Manual mode
    if (!autoSolveEnabled) {
      savedRequested.forEach((requested, blockId) => {
        const block = layoutDTO.blocks[blockId];
        if (block) {
          block.requested = requested;
        }
      });
    } else {
      // In Auto mode, sync machineCount to match requested (what solver says we need)
      Object.values(layoutDTO.blocks).forEach((block) => {
        if (block.type === "block") {
          const prodBlock = block as ProductionBlock;
          if (prodBlock.recipeId) {
            const recipe = recipes[prodBlock.recipeId];
            const machine = recipe ? machines[recipe.machineId] : null;
            if (recipe && machine && recipe.outputs[0]) {
              const yieldMult =
                recipe.category === "Gathering"
                  ? prodBlock.sourceYield ?? 1.0
                  : 1.0;
              const mainOutput = recipe.outputs[0];
              const ratePerMachine =
                ((mainOutput.amount * machine.speed) / recipe.craftingTime) *
                yieldMult;
              const requiredRate =
                prodBlock.requested?.[mainOutput.itemId] || 0;
              if (ratePerMachine > 0) {
                prodBlock.machineCount = requiredRate / ratePerMachine;
              }
            }
          }
        }
      });
    }

    // Always sync analysis results (demand, supply, output, satisfaction)
    factory.syncFromDTO(layoutDTO);

    // Forces React to see the change even if object references in maps are stable
    set({ version: Date.now() });
  },

  loadDemo: () => {
    const { factory, selectBlock } = get();
    factory.blocks.clear();
    factory.connections = [];

    const factory1 = factory.addBlock("Belt 2", 1250, 200);
    factory1.setRecipe("conveyor-belt-mk-ii");
    const factory2 = factory.addBlock("Belt 1", 950, 100);
    factory2.setRecipe("conveyor-belt-mk-i");
    const factory3 = factory.addBlock("Electromagnetic Turbine", 1250, 500);
    factory3.setRecipe("electromagnetic-turbine");
    const factory4 = factory.addBlock("iron ingot", 350, 100);
    factory4.setRecipe("iron-ingot");
    const factory5 = factory.addBlock("gear", 650, 100);
    factory5.setRecipe("gear");
    const factory6 = factory.addBlock("electric motor", 950, 400);
    factory6.setRecipe("electric-motor");
    const factory7 = factory.addBlock("magnetic coil", 650, 400);
    factory7.setRecipe("magnetic-coil");
    const factory8 = factory.addBlock("magnet", 350, 300);
    factory8.setRecipe("magnet");
    const factory9 = factory.addBlock("copper ingot", 350, 500);
    factory9.setRecipe("copper-ingot");
    const factory10 = factory.addBlock("THE END", 0, 0);
    factory10.setRecipe("universe-matrix");

    const mine1 = factory.addBlock("Iron Mine", 50, 200);
    mine1.setRecipe("mining-iron-ore");
    mine1.sourceYield = 6; // 6 veins
    mine1.requested["iron-ore"] = 3.0; // 6 veins × 0.5/s = 3/s

    const mine2 = factory.addBlock("Copper Mine", 50, 500);
    mine2.setRecipe("mining-copper-ore");
    mine2.sourceYield = 6;
    mine2.requested["copper-ore"] = 3.0;

    factory.connect(mine1.id, factory4.id, "iron-ore");
    factory.connect(mine2.id, factory9.id, "copper-ore");
    factory.connect(factory4.id, factory5.id, "iron-ingot");
    factory.connect(mine1.id, factory8.id, "iron-ore");
    factory.connect(factory8.id, factory7.id, "magnet");
    factory.connect(factory9.id, factory7.id, "copper-ingot");
    factory.connect(factory4.id, factory2.id, "iron-ingot");
    factory.connect(factory5.id, factory2.id, "gear");
    factory.connect(factory7.id, factory6.id, "magnetic-coil");
    factory.connect(factory2.id, factory1.id, "conveyor-belt-mk-i");
    factory.connect(factory7.id, factory3.id, "magnetic-coil");
    factory.connect(factory4.id, factory6.id, "iron-ingot");
    factory.connect(factory5.id, factory6.id, "gear");
    factory.connect(factory6.id, factory3.id, "electric-motor");
    factory.connect(factory3.id, factory1.id, "electromagnetic-turbine");

    selectBlock(null);
    //get().runSolver();
  },
}));
