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
import { serializeGraph, deserializeGraph } from "./graphSerializer";
import { sortBlockPorts } from "./core/sortBlockPorts";

interface FactoryState {
  // The Single Source of Truth for the Factory
  factory: FactoryGraph;
  version: number; // Increment to force re-renders
  selectedBlockId: string | null;
  selectedConnectionId: string | null;

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
  removeConnection: (id: string) => void;
  setRecipe: (blockId: string, recipeId: string | null) => void;
  setMachine: (blockId: string, machineId: string | null) => void;
  selectBlock: (id: string | null) => void;
  selectConnection: (id: string | null) => void;
  updateBlockName: (id: string, name: string) => void;
  setRequest: (blockId: string, itemId: string, rate: number) => void;
  setYield: (blockId: string, yieldValue: number) => void;
  setMachineCount: (blockId: string, count: number) => void;
  runSolver: () => void;
  loadDemo: () => void;
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

let solverTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSolve = (get: () => FactoryState) => {
  if (solverTimeout) clearTimeout(solverTimeout);
  solverTimeout = setTimeout(() => {
    get().runSolver();
    get().saveToLocalStorage();
  }, 300);
};

// Undo/Redo Stacks (Transient)
let undoStack: string[] = [];
let redoStack: string[] = [];

const pushToUndo = (factory: FactoryGraph) => {
  const snapshot = serializeGraph(factory);
  // Only push if different from last
  if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 50) undoStack.shift();
    redoStack = []; // Clear redo on new action
  }
};

export const useFactoryStore = create<FactoryState>((set, get) => ({
  factory: new FactoryGraph(),
  version: 0,
  selectedBlockId: null,
  selectedConnectionId: null,

  addBlock: (name, x, y) => {
    const { factory } = get();
    pushToUndo(factory);
    const block = factory.addBlock(name, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return block;
  },

  addSink: (name, x, y) => {
    const { factory } = get();
    pushToUndo(factory);
    const sink = factory.addSink(name, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return sink;
  },

  addLogistics: (subtype, x, y) => {
    const { factory } = get();
    pushToUndo(factory);
    const block = factory.addLogistics(subtype, x, y);
    set((state) => ({ version: state.version + 1 }));
    debouncedSolve(get);
    return block;
  },

  moveBlock: (id, x, y) => {
    const { factory } = get();
    pushToUndo(factory);
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
    pushToUndo(factory);
    factory.removeBlock(id);
    set((state) => ({
      version: state.version + 1,
      selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
    }));
    debouncedSolve(get);
  },

  connect: (sourceId: string, targetId: string, itemId: string) => {
    const { factory } = get();
    pushToUndo(factory);
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
    debouncedSolve(get);
  },

  setRecipe: (blockId, recipeId) => {
    const { factory } = get();
    const { recipes } = useGameDataStore.getState();
    const block = factory.blocks.get(blockId);
    if (block && block instanceof ProductionBlock) {
      pushToUndo(factory);
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
      debouncedSolve(get);
    }
  },

  setMachine: (blockId, machineId) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (block && block instanceof ProductionBlock) {
      pushToUndo(factory);
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

    pushToUndo(factory);

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
      pushToUndo(factory);
      block.sourceYield = yieldValue;
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  setMachineCount: (blockId, count) => {
    const { factory } = get();
    const block = factory.blocks.get(blockId);
    if (block instanceof ProductionBlock) {
      pushToUndo(factory);
      block.machineCount = count;
      set((state) => ({ version: state.version + 1 }));
      debouncedSolve(get);
    }
  },

  removeConnection: (id: string) => {
    const { factory, selectedConnectionId } = get();
    pushToUndo(factory);
    factory.removeConnection(id);
    set((state) => ({
      version: state.version + 1,
      selectedConnectionId:
        selectedConnectionId === id ? null : selectedConnectionId,
    }));
    debouncedSolve(get);
  },

  selectBlock: (id) => set({ selectedBlockId: id, selectedConnectionId: null }),

  selectConnection: (id) =>
    set({ selectedConnectionId: id, selectedBlockId: null }),

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
          // Temporarily remove constraints for auto-solve
          (block as unknown as Record<string, unknown>).machineCount =
            undefined;
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
    get().saveToLocalStorage();
  },

  saveToLocalStorage: () => {
    const { factory } = get();
    const json = serializeGraph(factory);
    localStorage.setItem("dsp_factory_save", json);
  },

  loadFromLocalStorage: () => {
    const { factory } = get();
    const json = localStorage.getItem("dsp_factory_save");
    if (json) {
      deserializeGraph(json, factory);
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
    pushToUndo(factory);
    try {
      deserializeGraph(json, factory);
      set((state) => ({ version: state.version + 1 }));
      get().runSolver();
      get().saveToLocalStorage();
    } catch (e) {
      console.error("Import failed", e);
    }
  },

  undo: () => {
    const { factory } = get();
    if (undoStack.length === 0) return;

    const current = serializeGraph(factory);
    redoStack.push(current);

    const prev = undoStack.pop()!;
    deserializeGraph(prev, factory);
    set((state) => ({ version: state.version + 1 }));
    get().runSolver();
    get().saveToLocalStorage();
  },

  redo: () => {
    const { factory } = get();
    if (redoStack.length === 0) return;

    const current = serializeGraph(factory);
    undoStack.push(current);

    const next = redoStack.pop()!;
    deserializeGraph(next, factory);
    set((state) => ({ version: state.version + 1 }));
    get().runSolver();
    get().saveToLocalStorage();
  },

  autoLayout: () => {
    const { factory } = get();
    const blocks = Array.from(factory.blocks.values());
    if (blocks.length === 0) return;

    pushToUndo(factory);

    // 1. Iterative Ranking (Topological Layering)
    // Every block starts at rank 0. If A -> B, then B.rank = max(B.rank, A.rank + 1)
    const ranks = new Map<string, number>();
    blocks.forEach((b) => ranks.set(b.id, 0));

    // Multiple passes to propagate rank
    // Limit to block count to prevent infinite loops (cyclic graphs)
    for (let i = 0; i < blocks.length; i++) {
      let changed = false;
      factory.connections.forEach((conn) => {
        const rSrc = ranks.get(conn.sourceBlockId) ?? 0;
        const rTgt = ranks.get(conn.targetBlockId) ?? 0;
        if (rTgt <= rSrc) {
          ranks.set(conn.targetBlockId, rSrc + 1);
          changed = true;
        }
      });
      if (!changed) break;
    }

    // 2. Group blocks by their assigned rank (Column)
    const groups = new Map<number, typeof blocks>();
    blocks.forEach((b) => {
      const r = ranks.get(b.id) ?? 0;
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(b);
    });

    const COL_WIDTH = 500;
    const ROW_HEIGHT = 320;
    const START_X = 100;

    // Sort ranks to process left-to-right
    const sortedRanks = Array.from(groups.keys()).sort((a, b) => a - b);

    // Helper: Map connecting Target -> Sources for quick lookup
    const incomingMap = new Map<string, string[]>();
    factory.connections.forEach((c) => {
      if (!incomingMap.has(c.targetBlockId))
        incomingMap.set(c.targetBlockId, []);
      incomingMap.get(c.targetBlockId)!.push(c.sourceBlockId);
    });

    // 3. Lane Logic Placement (Phase 17)
    // Process columns left-to-right.
    // For each column, determine vertical order by the average Y of sources.

    sortedRanks.forEach((rank) => {
      const group = groups.get(rank)!;
      const x = START_X + rank * COL_WIDTH;

      // Special handling for First Rank (Sources/User Start)
      if (rank === 0) {
        // Keep their relative Y order but stack them neatly centered
        group.sort((a, b) => a.position.y - b.position.y);
        const totalHeight = (group.length - 1) * ROW_HEIGHT;
        const centerY = 500; // Fixed center for the start column
        group.forEach((block, index) => {
          block.position.x = x;
          block.position.y = centerY + index * ROW_HEIGHT - totalHeight / 2;
        });
        return;
      }

      // For subsequent ranks: Calculate Ideal Y based on Upstream Sources
      const ideals = new Map<string, number>();

      group.forEach((block) => {
        const sourceIds = incomingMap.get(block.id) || [];
        let runningY = 0;
        let count = 0;

        sourceIds.forEach((srcId) => {
          const srcBlock = factory.blocks.get(srcId);
          if (srcBlock) {
            runningY += srcBlock.position.y;
            count++;
          }
        });

        // If connected, follow sources. If orphan, default to center (500)
        // or stay near previous layout? defaulting to 500 keeps it clean.
        ideals.set(block.id, count > 0 ? runningY / count : 500);
        block.position.x = x;
      });

      // Sort by Ideal Y (The "Lane Logic")
      // This ensures blocks with top-inputs float to top, bottom-inputs sink to bottom
      group.sort((a, b) => ideals.get(a.id)! - ideals.get(b.id)!);

      // Initial placement at Ideal Y
      group.forEach((b) => (b.position.y = ideals.get(b.id)!));

      // Collision Resolution (Smart Vertical Stacking)
      // Push blocks apart to enforce ROW_HEIGHT while trying to stay near Ideal Y
      let hasOverlap = true;
      let iterations = 0;

      while (hasOverlap && iterations < 10) {
        hasOverlap = false;
        // Downward sweep
        for (let i = 0; i < group.length - 1; i++) {
          const upper = group[i];
          const lower = group[i + 1];

          if (lower.position.y < upper.position.y + ROW_HEIGHT) {
            // Overlap detected. Push them apart symmetrically.
            const center = (upper.position.y + lower.position.y) / 2;
            const dist = ROW_HEIGHT / 2 + 1; // +1 buffer

            // Weighted push? No, symmetric is stable.
            upper.position.y = center - dist;
            lower.position.y = center + dist;
            hasOverlap = true;
          }
        }
        iterations++;
      }
    });

    // 4. Update Sort Orders for ports
    blocks.forEach((b) => sortBlockPorts(b, factory));

    set((state) => ({ version: state.version + 1 }));
  },

  clearFactory: () => {
    const { factory } = get();
    pushToUndo(factory);
    factory.blocks.clear();
    factory.connections = [];
    set({ version: Date.now(), selectedBlockId: null });
    get().saveToLocalStorage();
  },
}));
