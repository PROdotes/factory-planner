import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { isBlock, Block } from '../../types/block';
import { GameDefinition } from '@/types/game';

const MOCK_GAME: GameDefinition = {
    id: 'dsp',
    name: 'Test',
    version: '1.0',
    items: [
        { id: 'item-x', name: 'Item X', category: 'ore', stackSize: 100, color: '#F00' },
        { id: 'item-y', name: 'Item Y', category: 'product', stackSize: 100, color: '#00F' }
    ],
    recipes: [
        { id: 'recipe-source', name: 'Source', machineId: 'miner', inputs: [], outputs: [{ itemId: 'item-x', amount: 1 }], craftingTime: 1, category: 'mining' },
        { id: 'recipe-sink', name: 'Sink', machineId: 'smelter', inputs: [{ itemId: 'item-x', amount: 1 }], outputs: [{ itemId: 'item-y', amount: 1 }], craftingTime: 1, category: 'smelting' }
    ],
    machines: [
        { id: 'miner', name: 'Miner', category: 'miner', speed: 1, size: { width: 1, height: 1 } },
        { id: 'smelter', name: 'Smelter', category: 'smelter', speed: 1, size: { width: 1, height: 1 } }
    ],
    belts: [
        { id: 'belt-1', name: 'Belt', tier: 1, itemsPerSecond: 60, color: '#333' } // High capacity for flow testing
    ],
    settings: { rateUnit: 'minute', lanesPerBelt: 1, hasSpeedModifiers: true, gridSize: 1 }
};

const findConnectableRecipes = () => {
    // Hardcoded for mock
    return {
        outputRecipe: MOCK_GAME.recipes[0], // source
        inputRecipe: MOCK_GAME.recipes[1], // sink
        itemId: 'item-x'
    };
};

describe('useLayoutStore', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });
        useGameStore.getState().loadGameData(MOCK_GAME);
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('adds a block with ports and position', () => {
        const recipe = MOCK_GAME.recipes[0];
        useLayoutStore.getState().addBlock(recipe.id, { x: 10, y: 20 });

        const [node] = useLayoutStore.getState().nodes;
        expect(isBlock(node.data)).toBe(true);
        expect((node.data as Block).recipeId).toBe(recipe.id);
        expect(node.position).toEqual({ x: 10, y: 20 });
        expect(node.data.inputPorts).toHaveLength(recipe.inputs.length);
        expect(node.data.outputPorts).toHaveLength(recipe.outputs.length);
    });

    it('prevents self-connections', () => {
        const recipe = MOCK_GAME.recipes[1]; // sink has input and output (well, Sink usually has input, but our Mock Sink has output too for convenience? No, output item-y)
        // Ensure recipe has both input/output for self-connect test?
        // Actually self-connect can happen if I connect input to output of same node.

        useLayoutStore.getState().addBlock(recipe.id, { x: 0, y: 0 });

        const [node] = useLayoutStore.getState().nodes;
        const sourceHandle = node.data.outputPorts[0]?.id || 'out'; // sink has output
        const targetHandle = node.data.inputPorts[0]?.id || 'in'; // sink has input

        useLayoutStore.getState().onConnect({
            source: node.id,
            target: node.id,
            sourceHandle,
            targetHandle,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(0);
    });

    it('adds a valid connection between compatible ports', () => {
        const { outputRecipe, inputRecipe, itemId } = findConnectableRecipes();
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 100, y: 100 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        // Careful with ids, order depends on addBlock order
        // sourceNode should be source (0), targetNode should be sink (1)

        const sourceHandle = sourceNode.data.outputPorts.find(port => port.itemId === itemId)?.id;
        const targetHandle = targetNode.data.inputPorts.find(port => port.itemId === itemId)?.id;

        expect(sourceHandle).toBeDefined();
        expect(targetHandle).toBeDefined();

        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle: sourceHandle!,
            targetHandle: targetHandle!,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(1);
    });

    it('sets the active port when onPortClick is called', () => {
        const recipe = MOCK_GAME.recipes[0];
        useLayoutStore.getState().addBlock(recipe.id, { x: 0, y: 0 });
        const [node] = useLayoutStore.getState().nodes;
        const portId = node.data.outputPorts[0].id;

        useLayoutStore.getState().onPortClick(node.id, portId, 'output');

        expect(useLayoutStore.getState().activePort).toEqual({
            nodeId: node.id,
            portId: portId,
            type: 'output'
        });
    });

    it('creates a new block and connects it automatically via createAndConnect', () => {
        const { outputRecipe, inputRecipe, itemId } = findConnectableRecipes();

        // Add source block
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        const [sourceNode] = useLayoutStore.getState().nodes;
        const sourcePortId = sourceNode.data.outputPorts.find(p => p.itemId === itemId)!.id;

        // Create and connect input block
        useLayoutStore.getState().createAndConnect(
            inputRecipe.id,
            { x: 300, y: 0 },
            { nodeId: sourceNode.id, portId: sourcePortId, type: 'output', itemId }
        );

        expect(useLayoutStore.getState().nodes).toHaveLength(2);
        expect(useLayoutStore.getState().edges).toHaveLength(1);

        const edge = useLayoutStore.getState().edges[0];
        expect(edge.source).toBe(sourceNode.id);
        expect(edge.sourceHandle).toBe(sourcePortId);
    });

    it('calculates flow immediately on connect (Smoke Test)', () => {
        const { outputRecipe, inputRecipe, itemId } = findConnectableRecipes();

        // 1. Setup Source (High Rate) and Target
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 200, y: 0 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        const sourcePort = sourceNode.data.outputPorts.find(p => p.itemId === itemId)!;
        const targetPort = targetNode.data.inputPorts.find(p => p.itemId === itemId)!;

        // Ensure source has rate (Source block usually produces? Miner produces 60/m)
        // With rateUnit='minute', craftingTime=1, outputs=1 => 60/min.
        // But need applyBlockSolver to run? refreshGlobalRates uses applyBlockSolver.
        // addBlock calls refreshGlobalRates.
        // So sourcePort.rate should be 60.

        // 2. Connect
        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            sourceHandle: sourcePort.id,
            target: targetNode.id,
            targetHandle: targetPort.id,
        });

        // 3. Assert Flow
        const edge = useLayoutStore.getState().edges[0];
        // recalculateFlows runs onConnect.
        // flow should happen.
        const data = edge.data as any;
        expect(data.flowRate).toBeGreaterThan(0);
    });
});
