import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { produce } from 'immer';

// Mock Data for Loop Test
const ITEM_A = { id: "item-a", name: "Item A", category: "component", stackSize: 100 };
const ITEM_B = { id: "item-b", name: "Item B", category: "component", stackSize: 100 };

/*
  Recipe A: Consumes B -> Produces 2 A
  Recipe B: Consumes A -> Produces 1 B (Loop!)
  
  This is a simplified "Gain" loop.
  Start: Inject some B.
  A makes A... B makes B...
  Ideally, we want to see if it stabilizes or if rates explode.
  But for this test, we just want to ensure it doesn't CRASH and propagates.
*/

const RECIPE_A = {
    id: "make-a",
    name: "Make A",
    machineId: "assembler",
    inputs: [{ itemId: "item-b", amount: 1 }],
    outputs: [{ itemId: "item-a", amount: 2 }],
    craftingTime: 1.0,
    category: "assembling"
};

const RECIPE_B = {
    id: "make-b",
    name: "Make B",
    machineId: "assembler",
    inputs: [{ itemId: "item-a", amount: 1 }],
    outputs: [{ itemId: "item-b", amount: 1 }],
    craftingTime: 1.0,
    category: "assembling"
};

const MACHINE = {
    id: "assembler",
    name: "Assembler",
    category: "assembler",
    speed: 1.0,
    size: { width: 3, height: 3 }
};

describe('Circular Dependencies (Loops)', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });

        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
        useGameStore.getState().resetToDefault();

        useGameStore.getState().addItem(ITEM_A as any);
        useGameStore.getState().addItem(ITEM_B as any);
        useGameStore.getState().addMachine(MACHINE as any);
        useGameStore.getState().addRecipe(RECIPE_A as any);
        useGameStore.getState().addRecipe(RECIPE_B as any);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('handles a simple feedback loop without infinite recursion', () => {
        // 1. Create Block A (Target 60 A/min)
        const idA = useLayoutStore.getState().addBlock(RECIPE_A.id, { x: 0, y: 0 });

        // 2. Create Block B (Target 60 B/min)
        const idB = useLayoutStore.getState().addBlock(RECIPE_B.id, { x: 200, y: 0 });

        const [nodeA, nodeB] = useLayoutStore.getState().nodes;

        // 3. Connect A -> B (A feeds B)
        // A output port (Item A) -> B input port (Item A)
        const portA_Out = nodeA.data.outputPorts.find(p => p.itemId === 'item-a')!;
        const portB_In = nodeB.data.inputPorts.find(p => p.itemId === 'item-a')!;

        useLayoutStore.getState().onConnect({
            source: idA, sourceHandle: portA_Out.id,
            target: idB, targetHandle: portB_In.id
        });

        // 4. Connect B -> A (B feeds A) - CLOSING THE LOOP
        // B output port (Item B) -> A input port (Item B)
        const portB_Out = nodeB.data.outputPorts.find(p => p.itemId === 'item-b')!;
        const portA_In = nodeA.data.inputPorts.find(p => p.itemId === 'item-b')!;

        useLayoutStore.getState().onConnect({
            source: idB, sourceHandle: portB_Out.id,
            target: idA, targetHandle: portA_In.id
        });

        // If logic is broken, this might stack overflow or freeze.
        // If logic is robust (iterative solver), it should complete.

        const edges = useLayoutStore.getState().edges;
        expect(edges).toHaveLength(2);

        // Check if flow rates are calculated (non-zero implies propagation worked)
        // Since it's a loop with no external input, technically it might be "starved" 
        // if we didn't have the optimistic initialization. 
        // But our solver initiates with "Optimistic Rate" (Target Rate), so it should show full flow!

        const edgeAB = edges.find(e => e.source === idA)!;
        expect((edgeAB.data as any).flowRate).toBeGreaterThan(0);
    });
});
