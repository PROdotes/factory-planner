/**
 * ROLE: Factory Domain Store
 * PURPOSE: Manages the logical production layout via the OOP FactoryGraph.
 * RELATION: Bridges the React UI to the Domain Models.
 */

import { create } from "zustand";
import { useGameDataStore } from "../gamedata/gamedataStore";
import { FactoryGraph } from "./core/FactoryGraph";
import { ProductionBlock } from "./blocks/ProductionBlock";
import { LogisticsBlock } from "./blocks/LogisticsBlock";
import { GathererBlock } from "./blocks/GathererBlock";
import { serializeGraph, deserializeGraph } from "./graphSerializer";
import { sortBlockPorts } from "./core/sortBlockPorts";
import { undoRedoManager } from "./undoRedoManager";
import { performAutoLayout } from "./autoLayout";
import {
  createDebouncedSolver,
  runManualSolver,
  runAutoScale,
} from "./solverRunner";

interface FactoryState {
  // The Single Source of Truth for the Factory
  factory: FactoryGraph;
  version: number; // Increment to force re-renders
  selectedBlockId: string | null;
  selectedConnectionId: string | null;

  // Actions
  addBlock: (name: string, x: number, y: number) => ProductionBlock;
  addLogistics: (x: number, y: number) => LogisticsBlock;
  addGatherer: (name: string, x: number, y: number) => GathererBlock;
  moveBlock: (id: string, x: number, y: number) => void;
  removeBlock: (id: string) => void;

  connect: (sourceId: string, targetId: string, itemId: string) => void;
  removeConnection: (id: string) => void;
  setRecipe: (blockId: string, recipeId: string | null) => void;
  setGatherer: (blockId: string, gathererId: string | null) => void;
  setMachine: (blockId: string, machineId: string | null) => void;
  selectBlock: (id: string | null) => void;
  selectConnection: (id: string | null) => void;
  updateBlockName: (id: string, name: string) => void;
  setRequest: (blockId: string, itemId: string, rate: number) => void;
  setYield: (blockId: string, yieldValue: number) => void;
  setMachineCount: (blockId: string, count: number) => void;
  runSolver: () => void;
  autoScale: () => void;
  autoLayout: () => void;
  clearFactory: () => void;

  // Data Safety Actions
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  exportToJSON: () => void;
  importFromJSON: (json: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useFactoryStore = create<FactoryState>((set, get) => {
  const debouncedSolve = createDebouncedSolver(get);

  return {
    factory: new FactoryGraph(),
    version: 0,
    selectedBlockId: null,
    selectedConnectionId: null,

    addBlock: (name, x, y) => {
      const { factory } = get();
      undoRedoManager.push(factory);
      const block = factory.addBlock(name, x, y);
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve();
      return block;
    },

    addLogistics: (x, y) => {
      const { factory } = get();
      undoRedoManager.push(factory);
      const block = factory.addLogistics(x, y);
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve();
      return block;
    },

    addGatherer: (name, x, y) => {
      const { factory } = get();
      undoRedoManager.push(factory);
      const block = factory.addGatherer(name, x, y);
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve();
      return block;
    },

    moveBlock: (id, x, y) => {
      const { factory } = get();
      undoRedoManager.push(factory);
      factory.moveBlock(id, x, y);

      const block = factory.blocks.get(id);
      if (block) {
        sortBlockPorts(block, factory);
        // Update neighbors
        factory.connections.forEach((c) => {
          if (c.sourceBlockId === id) {
            const tgt = factory.blocks.get(c.targetBlockId);
            if (tgt) sortBlockPorts(tgt, factory);
          }
          if (c.targetBlockId === id) {
            const src = factory.blocks.get(c.sourceBlockId);
            if (src) sortBlockPorts(src, factory);
          }
        });
      }

      set((state) => ({ version: state.version + 1 }));
    },

    removeBlock: (id) => {
      const { factory, selectedBlockId } = get();
      undoRedoManager.push(factory);
      factory.removeBlock(id);
      set((state) => ({
        version: state.version + 1,
        selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
      }));
      debouncedSolve();
    },

    connect: (sourceId: string, targetId: string, itemId: string) => {
      const { factory } = get();
      undoRedoManager.push(factory);
      factory.connect(sourceId, targetId, itemId);

      // Logistics Support: Aggressive Item Adoption
      [sourceId, targetId].forEach((id) => {
        const b = factory.blocks.get(id);
        if (b && b.type === "logistics") {
          const itemKeys = Object.keys(b.demand);
          const hasRealItem = itemKeys.some((k) => k !== "unknown");

          // Adopt if literally empty OR if we only have 'unknown' and a REAL item arrived
          if ((itemKeys.length === 0 || !hasRealItem) && itemId !== "unknown") {
            b.demand = { [itemId]: 0 };
            b.supply = { [itemId]: 0 };
            b.output = { [itemId]: 0 };
          } else if (itemKeys.length === 0) {
            // Fallback: adopt the 'unknown' if that's all we have for now
            b.demand[itemId] = 0;
            b.supply[itemId] = 0;
            b.output[itemId] = 0;
          }
        }
      });

      // Sort ports for both involved blocks
      const src = factory.blocks.get(sourceId);
      if (src) sortBlockPorts(src, factory);
      const tgt = factory.blocks.get(targetId);
      if (tgt) sortBlockPorts(tgt, factory);

      set((state) => ({ version: state.version + 1 }));
      debouncedSolve();
    },

    setRecipe: (blockId, recipeId) => {
      const { factory } = get();
      const { recipes } = useGameDataStore.getState();
      const block = factory.blocks.get(blockId);
      if (block && block instanceof ProductionBlock) {
        undoRedoManager.push(factory);
        block.setRecipe(recipeId);
        // Auto-set machine from recipe
        if (recipeId) {
          const recipe = recipes[recipeId];
          if (recipe) {
            block.setMachine(recipe.machineId);
          }
        }
        sortBlockPorts(block, factory);
        set((state) => ({ version: state.version + 1 }));
        debouncedSolve();
      }
    },

    setGatherer: (blockId, gathererId) => {
      const { factory } = get();
      const { gatherers } = useGameDataStore.getState();
      const block = factory.blocks.get(blockId);
      if (block && block instanceof GathererBlock) {
        undoRedoManager.push(factory);
        block.setGatherer(gathererId);
        // Auto-set machine from gatherer
        if (gathererId) {
          const gatherer = gatherers[gathererId];
          if (gatherer) {
            block.setMachine(gatherer.machineId);
          }
        }
        sortBlockPorts(block, factory);
        set((state) => ({ version: state.version + 1 }));
        debouncedSolve();
      }
    },

    setMachine: (blockId, machineId) => {
      const { factory } = get();
      const block = factory.blocks.get(blockId);
      if (
        block &&
        (block instanceof ProductionBlock || block instanceof GathererBlock)
      ) {
        undoRedoManager.push(factory);
        block.setMachine(machineId);
        set((state) => ({ version: state.version + 1 }));
        debouncedSolve();
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

      undoRedoManager.push(factory);

      if (block instanceof ProductionBlock) {
        // Production blocks can have targeted output goals
        // If no recipe is set, they act as Storage/Sinks via their demand map
        if (!block.recipeId) {
          block.demand[itemId] = rate;
        } else {
          block.requested[itemId] = rate;
        }
      } else if (block instanceof GathererBlock) {
        // Gatherer blocks use gathererId
        if (!block.gathererId) {
          block.demand[itemId] = rate;
        } else {
          block.requested[itemId] = rate;
        }
      }

      set((state) => ({ version: state.version + 1 }));
      debouncedSolve();
    },

    setYield: (blockId, yieldValue) => {
      const { factory } = get();
      const block = factory.blocks.get(blockId);
      if (block) {
        undoRedoManager.push(factory);
        block.sourceYield = yieldValue;
        set((state) => ({ version: state.version + 1 }));
        debouncedSolve();
      }
    },

    setMachineCount: (blockId, count) => {
      const { factory } = get();
      const block = factory.blocks.get(blockId);
      if (block instanceof ProductionBlock || block instanceof GathererBlock) {
        undoRedoManager.push(factory);
        block.machineCount = count;
        set((state) => ({ version: state.version + 1 }));
        debouncedSolve();
      }
    },

    removeConnection: (id: string) => {
      const { factory, selectedConnectionId } = get();
      undoRedoManager.push(factory);
      factory.removeConnection(id);
      set((state) => ({
        version: state.version + 1,
        selectedConnectionId:
          selectedConnectionId === id ? null : selectedConnectionId,
      }));
      debouncedSolve();
    },

    selectBlock: (id) =>
      set({ selectedBlockId: id, selectedConnectionId: null }),

    selectConnection: (id) =>
      set({ selectedConnectionId: id, selectedBlockId: null }),

    runSolver: () => {
      const { factory, version } = get();
      const { recipes, machines, gatherers, isLoaded } =
        useGameDataStore.getState();
      if (!isLoaded) return;

      runManualSolver(factory, recipes, machines, gatherers);
      set({ version: version + 1 });
    },

    autoScale: () => {
      const { factory, version, runSolver } = get();
      const { recipes, machines, gatherers, isLoaded } =
        useGameDataStore.getState();
      if (!isLoaded) return;

      runAutoScale(factory, recipes, machines, gatherers);
      runSolver();
      set({ version: version + 1 });
    },

    saveToLocalStorage: () => {
      const { factory } = get();
      const json = serializeGraph(factory);
      localStorage.setItem("dsp_factory_save", json);
    },

    loadFromLocalStorage: () => {
      const { factory } = get();
      const { recipes, gatherers } = useGameDataStore.getState();
      const json = localStorage.getItem("dsp_factory_save");
      if (json) {
        deserializeGraph(json, factory, recipes, gatherers);
        set((state) => ({ version: state.version + 1 }));
        get().runSolver();
      }
    },

    exportToJSON: () => {
      const { factory } = get();
      const json = serializeGraph(factory);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factory_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importFromJSON: (json: string) => {
      const { factory } = get();
      const { recipes, gatherers } = useGameDataStore.getState();
      undoRedoManager.push(factory);
      try {
        deserializeGraph(json, factory, recipes, gatherers);
        set((state) => ({ version: state.version + 1 }));
        get().runSolver();
        get().saveToLocalStorage();
      } catch (e) {
        console.error("Import failed", e);
      }
    },

    undo: () => {
      const { factory } = get();
      const { recipes, gatherers } = useGameDataStore.getState();
      if (!undoRedoManager.canUndo()) return;

      const current = serializeGraph(factory);
      undoRedoManager.pushToRedo(current);

      const prev = undoRedoManager.popUndo();
      if (prev) {
        deserializeGraph(prev, factory, recipes, gatherers);
        set((state) => ({ version: state.version + 1 }));
        get().runSolver();
        get().saveToLocalStorage();
      }
    },

    redo: () => {
      const { factory } = get();
      const { recipes, gatherers } = useGameDataStore.getState();
      if (!undoRedoManager.canRedo()) return;

      const current = serializeGraph(factory);
      undoRedoManager.pushToUndo(current);

      const next = undoRedoManager.popRedo();
      if (next) {
        deserializeGraph(next, factory, recipes, gatherers);
        set((state) => ({ version: state.version + 1 }));
        get().runSolver();
        get().saveToLocalStorage();
      }
    },

    autoLayout: () => {
      const { factory } = get();
      if (factory.blocks.size === 0) return;

      undoRedoManager.push(factory);
      performAutoLayout(factory);
      set((state) => ({ version: state.version + 1 }));
    },

    clearFactory: () => {
      const { factory } = get();
      undoRedoManager.push(factory);
      factory.blocks.clear();
      factory.connections = [];
      set({ version: Date.now(), selectedBlockId: null });
      get().saveToLocalStorage();
    },
  };
});
