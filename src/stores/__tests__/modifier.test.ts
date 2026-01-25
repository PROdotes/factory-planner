import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';


// Mock Data
const RECIPE = {
    id: "iron-ingot",
    name: "Iron Ingot",
    machineId: "smelter",
    inputs: [{ itemId: "iron-ore", amount: 1 }],
    outputs: [{ itemId: "iron-ingot", amount: 1 }],
    craftingTime: 1.0,
    category: "smelting"
};

const MACHINE = {
    id: "smelter",
    name: "Smelter",
    category: "smelter",
    speed: 1.0,
    size: { width: 2, height: 2 }
};

describe('Modifiers (Speed & Productivity)', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', { randomUUID: () => `test-${counter++}` });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
        useGameStore.getState().resetToDefault();
        useGameStore.getState().addMachine(MACHINE as any);
        useGameStore.getState().addRecipe(RECIPE as any);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('correctly applies Speed Modifier', () => {
        // 1. Add Block with default settings
        const id = useLayoutStore.getState().addBlock(RECIPE.id, { x: 0, y: 0 });

        // Target 60/min. Base speed 1.0 -> 60/min per machine -> 1 machine.
        let [node] = useLayoutStore.getState().nodes;
        expect(node.data.machineCount).toBeCloseTo(1.0);

        // 2. Turn on Speed Mk.2 (+50% Speed)
        // Level 2 Speed
        useLayoutStore.getState().updateBlock(id, {
            modifier: { type: 'speed', level: 2, includeConsumption: true }
        });

        [node] = useLayoutStore.getState().nodes;
        // Speed = 1.0 * 1.5 = 1.5
        // Output per machine = 90/min
        // Needed for 60/min = 60/90 = 0.666...
        expect(node.data.machineCount).toBeCloseTo(0.6666, 3);

        // Input rate should match Output rate (1:1 recipe)
        // 0.666 machines * 1 input/s * 1.5 speed = 1.0 input/s = 60/min
        const inputPort = node.data.inputPorts[0];
        expect(inputPort.rate).toBeCloseTo(60);
    });

    it('correctly applies Productivity Modifier', () => {
        const id = useLayoutStore.getState().addBlock(RECIPE.id, { x: 0, y: 0 });

        // 2. Turn on Prod Mk.2 (+20% Products)
        // Level 2 Productivity
        useLayoutStore.getState().updateBlock(id, {
            modifier: { type: 'productivity', level: 2, includeConsumption: true }
        });

        const [node] = useLayoutStore.getState().nodes;

        // Speed = 1.0 (Prod doesn't slow down in DSP by default here)
        // Output per craft = 1.0 * 1.2 = 1.2
        // Output per machine = (1.2 / 1s) * 60 = 72/min
        // Needed for 60/min = 60 / 72 = 0.8333...
        expect(node.data.machineCount).toBeCloseTo(0.8333, 3);

        // Input Rate (check for free items)
        // 0.833 machines * 1 input/s * 1.0 speed = 0.833 input/s = 50/min
        // We are producing 60 items from 50 inputs!
        const inputPort = node.data.inputPorts[0];
        // 60 output / 1.2 prod = 50 input
        expect(inputPort.rate).toBeCloseTo(50);
    });
});
