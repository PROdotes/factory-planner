import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { GameDefinition } from '@/types/game';
import { BeltEdgeData } from '@/types/block';

// Mock conflict detection to focus purely on flow logic
vi.mock('@/lib/validation/conflictDetection', () => ({
    findChannelConflicts: () => [],
    findNodeConflicts: () => new Set(),
    getChannelSegments: () => []
}));

// Reuse Test Game Definition
const TEST_GAME: GameDefinition = {
    id: 'dsp',
    name: 'Test Game',
    version: '1.0.0',
    settings: { lanesPerBelt: 1, hasSpeedModifiers: true, rateUnit: 'minute', gridSize: 10 },
    items: [{ id: 'ore', name: 'Ore', category: 'ore', stackSize: 100 }],
    recipes: [{
        id: 'mining', name: 'Mining', machineId: 'miner', category: 'mining', craftingTime: 1,
        inputs: [], outputs: [{ itemId: 'ore', amount: 1 }]
    }],
    machines: [{ id: 'miner', name: 'Miner', category: 'miner', speed: 1.0, size: { width: 1, height: 1 } }],
    belts: [{ id: 'belt-1', name: 'Belt', tier: 1, itemsPerSecond: 100, color: 'blue' }] // High capacity
};

describe('Proportional Demand Logic (Mergers)', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', { randomUUID: () => `test-id-${counter++}` });
        useGameStore.setState({ game: JSON.parse(JSON.stringify(TEST_GAME)) });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const createMiner = (rate: number, x: number, y: number) => {
        const id = useLayoutStore.getState().addBlock('mining', { x, y });
        useLayoutStore.getState().updateBlock(id, { targetRate: rate });
        return id;
    };

    const getEdge = (source: string, target: string) => {
        return useLayoutStore.getState().edges.find(e => e.source === source && e.target === target);
    };

    it('correctly satisfaction demand when merger inputs sum to target demand', () => {
        // Source A: 30
        const idA = createMiner(30, 0, 0);
        // Source B: 30
        const idB = createMiner(30, 0, 100);

        // Target C: 60 (We use a Miner acting as sink/consumer for simplicity or just check merger output? 
        // Ideally we need a consumer. Let's create a "Consumer" recipe/block or just drive a demand via logic)
        // Actually, layoutStore checks "demandRate" on the TARGET PORT.
        // We can use a miner with inputs added dynamically or just a custom block.
        // Let's create a custom 'Consumer' block in the store for this test.

        // ACTUALLY: Let's use a "Smelter" that consumes Ore -> Ingot. 
        // Rate 60 means it consumes 60.
        // Add Smelter to test game
        const game = useGameStore.getState().game;
        game.items.push({ id: 'ingot', name: 'Ingot', category: 'ingot', stackSize: 100 });
        game.recipes.push({
            id: 'smelting', name: 'Smelting', machineId: 'smelter', category: 'smelting', craftingTime: 1,
            inputs: [{ itemId: 'ore', amount: 1 }], outputs: [{ itemId: 'ingot', amount: 1 }]
        });
        game.machines.push({ id: 'smelter', name: 'Smelter', category: 'smelter', speed: 1.0, size: { width: 1, height: 1 } });

        const idMerger = useLayoutStore.getState().addSplitter('merger', { x: 100, y: 50 });
        const idTarget = useLayoutStore.getState().addBlock('smelting', { x: 200, y: 50 });
        // Target demands 60
        useLayoutStore.getState().updateBlock(idTarget, { targetRate: 60 });

        // Connect A -> Merger (Input 1)
        const nodeA = useLayoutStore.getState().nodes.find(n => n.id === idA)!;
        const nodeB = useLayoutStore.getState().nodes.find(n => n.id === idB)!;
        const nodeMerger = useLayoutStore.getState().nodes.find(n => n.id === idMerger)!;
        const nodeTarget = useLayoutStore.getState().nodes.find(n => n.id === idTarget)!;

        // Connections
        useLayoutStore.getState().onConnect({
            source: idA, sourceHandle: nodeA.data.outputPorts[0].id,
            target: idMerger, targetHandle: nodeMerger.data.inputPorts[0].id
        });
        useLayoutStore.getState().onConnect({
            source: idB, sourceHandle: nodeB.data.outputPorts[0].id,
            target: idMerger, targetHandle: nodeMerger.data.inputPorts[1].id
        });
        useLayoutStore.getState().onConnect({
            source: idMerger, sourceHandle: nodeMerger.data.outputPorts[0].id,
            target: idTarget, targetHandle: nodeTarget.data.inputPorts[0].id
        });

        const edgeA = getEdge(idA, idMerger)!;
        const edgeB = getEdge(idB, idMerger)!;
        const edgeOut = getEdge(idMerger, idTarget)!;

        // Verify Flow
        // Merger Output: Should be 60. Target needs 60.
        expect((edgeOut.data as BeltEdgeData).flowRate).toBe(60);
        expect((edgeOut.data as BeltEdgeData).demandRate).toBe(60);
        expect((edgeOut.data as BeltEdgeData).status).toBe('ok');

        // Inputs:
        // A provides 30. Demand should be 30 (since system is satisfied, it takes what we give).
        // If the logic is "Total Demand distributed by Contribution", and contribution is (30 / 60) * 60 = 30.
        // Wait, logic says: if satisfied, demand = mySupply.
        expect((edgeA.data as BeltEdgeData).flowRate).toBe(30);
        expect((edgeA.data as BeltEdgeData).demandRate).toBe(30);
        expect((edgeA.data as BeltEdgeData).status).toBe('ok'); // 30 supply >= 30 demand

        expect((edgeB.data as BeltEdgeData).flowRate).toBe(30);
        expect((edgeB.data as BeltEdgeData).demandRate).toBe(30);
        expect((edgeB.data as BeltEdgeData).status).toBe('ok');
    });

    it('flags underload when total supply is insufficient', () => {
        // Reuse setup but reduce supply
        const game = useGameStore.getState().game;
        game.items.push({ id: 'ingot', name: 'Ingot', category: 'ingot', stackSize: 100 });
        game.recipes.push({
            id: 'smelting', name: 'Smelting', machineId: 'smelter', category: 'smelting', craftingTime: 1,
            inputs: [{ itemId: 'ore', amount: 1 }], outputs: [{ itemId: 'ingot', amount: 1 }]
        });
        game.machines.push({ id: 'smelter', name: 'Smelter', category: 'smelter', speed: 1.0, size: { width: 1, height: 1 } });

        // A: 10, B: 10. Total 20. Target: 60.
        const idA = createMiner(10, 0, 0);
        const idB = createMiner(10, 0, 100);
        const idMerger = useLayoutStore.getState().addSplitter('merger', { x: 100, y: 50 });
        const idTarget = useLayoutStore.getState().addBlock('smelting', { x: 200, y: 50 });
        useLayoutStore.getState().updateBlock(idTarget, { targetRate: 60 });

        const nodeA = useLayoutStore.getState().nodes.find(n => n.id === idA)!;
        const nodeB = useLayoutStore.getState().nodes.find(n => n.id === idB)!;
        const nodeMerger = useLayoutStore.getState().nodes.find(n => n.id === idMerger)!;
        const nodeTarget = useLayoutStore.getState().nodes.find(n => n.id === idTarget)!;

        useLayoutStore.getState().onConnect({
            source: idA, sourceHandle: nodeA.data.outputPorts[0].id,
            target: idMerger, targetHandle: nodeMerger.data.inputPorts[0].id
        });
        useLayoutStore.getState().onConnect({
            source: idB, sourceHandle: nodeB.data.outputPorts[0].id,
            target: idMerger, targetHandle: nodeMerger.data.inputPorts[1].id
        });
        useLayoutStore.getState().onConnect({
            source: idMerger, sourceHandle: nodeMerger.data.outputPorts[0].id,
            target: idTarget, targetHandle: nodeTarget.data.inputPorts[0].id
        });

        const edgeA = getEdge(idA, idMerger)!;

        // Total Supply 20. Total Demand 60.
        // A contributes 10 (50%).
        // Demand propagation: (10 / 20) * 60 = 30.
        // A supplies 10. Demand 30. -> Underload.

        expect((edgeA.data as BeltEdgeData).flowRate).toBe(10);
        expect((edgeA.data as BeltEdgeData).demandRate).toBe(30);
        expect((edgeA.data as BeltEdgeData).status).toBe('underload');
    });
});
