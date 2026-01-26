import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { isBlock, Block } from '../../types/block';

// Mock Plasma Refining Recipe
const PLASMA_RECIPE = {
    id: "plasma-refining",
    name: "Plasma Refining",
    machineId: "refinery",
    inputs: [{ itemId: "crude-oil", amount: 2 }],
    outputs: [
        { itemId: "refined-oil", amount: 2 },
        { itemId: "hydrogen", amount: 1 }
    ],
    craftingTime: 4.0, // 4 seconds
    category: "refining"
} as const;

// Ensure items exist
const ITEMS = [
    { id: "crude-oil", name: "Crude Oil", category: "fluid", stackSize: 20 },
    { id: "refined-oil", name: "Refined Oil", category: "fluid", stackSize: 20 },
    { id: "hydrogen", name: "Hydrogen", category: "fluid", stackSize: 20 }
];

const MACHINE = {
    id: "refinery",
    name: "Refinery",
    category: "refining",
    speed: 1.0,
    size: { width: 3, height: 3 }
};

describe('Multi-Output (Byproduct) Logic', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });

        // Reset Stores
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
        useGameStore.getState().resetToDefault();

        // Inject Test Data
        ITEMS.forEach(i => useGameStore.getState().addItem(i as any));
        useGameStore.getState().addMachine(MACHINE as any);
        useGameStore.getState().addRecipe(PLASMA_RECIPE as any);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('correctly creates ports for multi-output recipes', () => {
        useLayoutStore.getState().addBlock(PLASMA_RECIPE.id, { x: 0, y: 0 });
        const [node] = useLayoutStore.getState().nodes;

        expect(isBlock(node.data)).toBe(true);
        expect((node.data as Block).recipeId).toBe(PLASMA_RECIPE.id);
        expect(node.data.outputPorts).toHaveLength(2);

        const refinedOil = node.data.outputPorts.find(p => p.itemId === 'refined-oil');
        const hydrogen = node.data.outputPorts.find(p => p.itemId === 'hydrogen');

        expect(refinedOil).toBeDefined();
        expect(hydrogen).toBeDefined();
    });

    it('calculates rates based on primary output (default)', () => {
        // Default target is 60/min.
        // Recipe: 2 Refined Oil / 4s = 0.5/s = 30/min per machine.
        // So for 60/min target, we need 2 machines.

        useLayoutStore.getState().addBlock(PLASMA_RECIPE.id, { x: 0, y: 0 });
        const [node] = useLayoutStore.getState().nodes;

        expect(isBlock(node.data)).toBe(true);
        expect((node.data as Block).targetRate).toBe(60);
        expect((node.data as Block).machineCount).toBeCloseTo(2);

        // Verify Output Rates
        // Refined Oil: 2 machines * 30/min = 60/min
        // Hydrogen: 2 machines * (1/4 * 60 = 15/min) = 30/min

        const refinedOil = node.data.outputPorts.find(p => p.itemId === 'refined-oil')!;
        const hydrogen = node.data.outputPorts.find(p => p.itemId === 'hydrogen')!;

        expect(refinedOil.rate).toBeCloseTo(60);
        expect(hydrogen.rate).toBeCloseTo(30);
    });

    it('recalculates rates when target rate changes', () => {
        const id = useLayoutStore.getState().addBlock(PLASMA_RECIPE.id, { x: 0, y: 0 });

        // Change target to 120 (Refined Oil) -> 4 Machines
        useLayoutStore.getState().updateBlock(id, { targetRate: 120 });

        const [node] = useLayoutStore.getState().nodes;
        expect(isBlock(node.data)).toBe(true);
        expect((node.data as Block).machineCount).toBeCloseTo(4);

        const hydrogen = node.data.outputPorts.find(p => p.itemId === 'hydrogen')!;
        // 4 machines * 15/min = 60/min
        expect(hydrogen.rate).toBeCloseTo(60);
    });

    it('respects primaryOutputId when changed', () => {
        const id = useLayoutStore.getState().addBlock(PLASMA_RECIPE.id, { x: 0, y: 0 });

        // Default: Target 60 Refined Oil (0.5/s/machine = 30/min/machine) -> 2 machines
        // Hydrogen output is 30.

        // NOW: Switch primary output to Hydrogen.
        // Target 60 Hydrogen.
        // Hydrogen base: 1 item / 4s = 0.25/s = 15/min per machine.
        // To get 60 Hydrogen, we need 60 / 15 = 4 machines.

        useLayoutStore.getState().updateBlock(id, {
            primaryOutputId: 'hydrogen',
            targetRate: 60
        });

        const [node] = useLayoutStore.getState().nodes;

        expect(isBlock(node.data)).toBe(true);
        expect((node.data as Block).primaryOutputId).toBe('hydrogen');
        expect((node.data as Block).machineCount).toBeCloseTo(4);

        const refinedOil = node.data.outputPorts.find(p => p.itemId === 'refined-oil')!;
        const hydrogen = node.data.outputPorts.find(p => p.itemId === 'hydrogen')!;

        // Refined Oil: 4 machines * 30/min = 120/min
        expect(refinedOil.rate).toBeCloseTo(120);
        // Hydrogen: 4 machines * 15/min = 60/min (Target)
        expect(hydrogen.rate).toBeCloseTo(60);
    });
});
