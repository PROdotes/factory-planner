import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { GameDefinition, Recipe } from '@/types/game';
import { BeltEdgeData } from '@/types/block';

// ----------------------------------------------------------------------------
// TEST DATA
// ----------------------------------------------------------------------------
const TEST_GAME: GameDefinition = {
    id: 'dsp',
    name: 'Test Game',
    version: '0.0.1',
    settings: {
        lanesPerBelt: 1,
        hasSpeedModifiers: true,
        rateUnit: 'minute',
        gridSize: 10
    },
    items: [
        { id: 'ore', name: 'Ore', category: 'ore', stackSize: 100 },
        { id: 'ingot', name: 'Ingot', category: 'ingot', stackSize: 100 },
        { id: 'product', name: 'Product', category: 'product', stackSize: 100 }
    ],
    recipes: [
        {
            id: 'mining-ore',
            name: 'Mining Ore',
            machineId: 'miner',
            category: 'mining',
            craftingTime: 1, // 1 sec
            inputs: [],
            outputs: [{ itemId: 'ore', amount: 1 }] // 60/min base
        },
        {
            id: 'smelting-ingot',
            name: 'Smelting Ingot',
            machineId: 'smelter',
            category: 'smelting',
            craftingTime: 1, // 1 sec
            inputs: [{ itemId: 'ore', amount: 1 }], // Needs 60/min base
            outputs: [{ itemId: 'ingot', amount: 1 }] // Produces 60/min base
        }
    ],
    machines: [
        {
            id: 'miner',
            name: 'Miner',
            category: 'miner',
            speed: 1.0,
            size: { width: 1, height: 1 }
        },
        {
            id: 'smelter',
            name: 'Smelter',
            category: 'smelter',
            speed: 1.0,
            size: { width: 1, height: 1 }
        },
        {
            id: 'assembler',
            name: 'Assembler',
            category: 'assembler',
            speed: 1.0,
            size: { width: 1, height: 1 }
        }
    ],
    belts: [
        {
            id: 'belt-mk1',
            name: 'Belt Mk1',
            tier: 1,
            itemsPerSecond: 1, // 60 items/min
            color: 'blue'
        },
        {
            id: 'belt-mk2',
            name: 'Belt Mk2',
            tier: 2,
            itemsPerSecond: 2, // 120 items/min
            color: 'green'
        }
    ]
};

// ----------------------------------------------------------------------------
// TESTS
// ----------------------------------------------------------------------------

describe('Conflict & Multiplier Engine', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });

        useGameStore.setState({ game: JSON.parse(JSON.stringify(TEST_GAME)) });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const createBlock = (recipeId: string, x: number, y: number, targetRate = 60) => {
        const id = useLayoutStore.getState().addBlock(recipeId, { x, y });
        useLayoutStore.getState().updateBlock(id, { targetRate });
        return id;
    };

    const getEdgeData = (edgeIndex = 0) => {
        const edge = useLayoutStore.getState().edges[edgeIndex];
        return edge.data as BeltEdgeData;
    };

    it('handles high throughput (Infinite Bundle) without bottleneck status', () => {
        // Mining Ore at 120/min
        const sourceId = createBlock('mining-ore', 0, 0, 120);

        // Smelt Ingot at 120/min
        const targetId = createBlock('smelting-ingot', 200, 0, 120);

        const sourceNode = useLayoutStore.getState().nodes.find(n => n.id === sourceId)!;
        const targetNode = useLayoutStore.getState().nodes.find(n => n.id === targetId)!;

        useLayoutStore.getState().onConnect({
            source: sourceId,
            sourceHandle: sourceNode.data.outputPorts[0].id,
            target: targetId,
            targetHandle: targetNode.data.inputPorts[0].id
        });

        // Supply 120, Capacity 60 (Mk1).
        // Expect: No bottleneck status, flowRate 120 (Infinite Bundle)
        const edgeData = getEdgeData();
        expect(edgeData.status).not.toBe('bottleneck');
        expect(edgeData.flowRate).toBe(120);
        expect(edgeData.demandRate).toBe(120);
    });

    it('detects Starvation (Amber) when supply < demand', () => {
        // Mining Ore at 30/min
        const sourceId = createBlock('mining-ore', 0, 0, 30);

        // Smelt Ingot at 60/min (Needs 60 Ore)
        const targetId = createBlock('smelting-ingot', 200, 0, 60);

        const sourceNode = useLayoutStore.getState().nodes.find(n => n.id === sourceId)!;
        const targetNode = useLayoutStore.getState().nodes.find(n => n.id === targetId)!;

        useLayoutStore.getState().onConnect({
            source: sourceId,
            sourceHandle: sourceNode.data.outputPorts[0].id,
            target: targetId,
            targetHandle: targetNode.data.inputPorts[0].id
        });

        // Supply 30, Demand 60.
        // Supply < Demand -> Underload
        const edgeData = getEdgeData();
        expect(edgeData.status).toBe('underload');
        expect(edgeData.flowRate).toBe(30);
    });

    it('updates edge status when source rate changes', () => {
        // Start ok: 60 -> 60
        const sourceId = createBlock('mining-ore', 0, 0, 60);
        const targetId = createBlock('smelting-ingot', 200, 0, 60);

        const sourceNode = useLayoutStore.getState().nodes.find(n => n.id === sourceId)!;
        const targetNode = useLayoutStore.getState().nodes.find(n => n.id === targetId)!;

        useLayoutStore.getState().onConnect({
            source: sourceId,
            sourceHandle: sourceNode.data.outputPorts[0].id,
            target: targetId,
            targetHandle: targetNode.data.inputPorts[0].id
        });

        expect(getEdgeData().status).toBe('ok');

        // Increase Source to 120 -> Still OK (Infinite Bundle holds it)
        useLayoutStore.getState().updateBlock(sourceId, { targetRate: 120 });
        expect(getEdgeData().status).toBe('ok');

        // Reduce Source to 30 -> Underload (Demand 60 > Supply 30)
        useLayoutStore.getState().updateBlock(sourceId, { targetRate: 30 });
        expect(getEdgeData().status).toBe('underload');
    });

    it('propagates Starvation downstream (3-block chain)', () => {
        // Chain: A (30) -> B (60) -> C (60)
        // A produces 30 (starved).
        // B needs 60. Receives 30. Satisfaction 0.5. Outputs 30.
        // C needs 60. Receives 30 from B.
        // Expectation: Edge B->C is Underload (Supply 30, Demand 60).

        // A
        const idA = createBlock('mining-ore', 0, 0, 30);
        // B
        const idB = createBlock('smelting-ingot', 200, 0, 60);

        // Dynamic Recipe for C: Ingot -> Product
        const recipeIngotToProduct: Recipe = {
            id: 'assembling-product',
            name: 'Product',
            machineId: 'assembler',
            category: 'assembling',
            craftingTime: 1,
            inputs: [{ itemId: 'ingot', amount: 1 }],
            outputs: [{ itemId: 'product', amount: 1 }]
        };

        // Add to game store
        useGameStore.getState().addRecipe(recipeIngotToProduct);

        // C
        const idC = createBlock('assembling-product', 400, 0, 60);

        // Connect A -> B
        const nodeA = useLayoutStore.getState().nodes.find(n => n.id === idA)!;
        const nodeB = useLayoutStore.getState().nodes.find(n => n.id === idB)!;
        const nodeC = useLayoutStore.getState().nodes.find(n => n.id === idC)!;

        // A->B
        useLayoutStore.getState().onConnect({
            source: idA,
            sourceHandle: nodeA.data.outputPorts[0].id,
            target: idB,
            targetHandle: nodeB.data.inputPorts[0].id // Ore
        });

        // Connect B -> C
        useLayoutStore.getState().onConnect({
            source: idB,
            sourceHandle: nodeB.data.outputPorts[0].id, // Ingot
            target: idC,
            targetHandle: nodeC.data.inputPorts[0].id // Ingot
        });

        // Verify Edge 2 (B->C)
        const edges = useLayoutStore.getState().edges;
        expect(edges).toHaveLength(2);

        // Edge 0: A->B
        // Supply 30. Demand 60. Status: Underload.
        const edgeAB = edges.find(e => e.source === idA && e.target === idB)!;
        expect((edgeAB.data as BeltEdgeData).status).toBe('underload');
        expect((edgeAB.data as BeltEdgeData).flowRate).toBe(30);

        // Edge 1: B->C
        // B receives 30 Ore (need 60). Satisfaction 0.5.
        // B Output Ingot: Rate 60 * 0.5 = 30.
        // C Demand: 60 Product (needs 60 Ingot).
        // Edge B->C: Supply 30. Demand 60.
        const edgeBC = edges.find(e => e.source === idB && e.target === idC)!;

        expect((edgeBC.data as BeltEdgeData).flowRate).toBe(30);
        expect((edgeBC.data as BeltEdgeData).demandRate).toBe(60);
        expect((edgeBC.data as BeltEdgeData).status).toBe('underload');
    });
});
