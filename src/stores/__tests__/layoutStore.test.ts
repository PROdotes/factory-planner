import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { DSP_DATA } from '@/data/dsp';

const findConnectableRecipes = () => {
    for (const outputRecipe of DSP_DATA.recipes) {
        for (const output of outputRecipe.outputs) {
            for (const inputRecipe of DSP_DATA.recipes) {
                if (outputRecipe.id === inputRecipe.id) continue;
                const match = inputRecipe.inputs.find(input => input.itemId === output.itemId);
                if (match) {
                    return {
                        outputRecipe,
                        inputRecipe,
                        itemId: output.itemId,
                    };
                }
            }
        }
    }
    return null;
};

const findMismatchedRecipes = () => {
    for (const outputRecipe of DSP_DATA.recipes) {
        for (const output of outputRecipe.outputs) {
            for (const inputRecipe of DSP_DATA.recipes) {
                const input = inputRecipe.inputs.find(candidate => candidate.itemId !== output.itemId);
                if (input) {
                    return {
                        outputRecipe,
                        inputRecipe,
                        outputItemId: output.itemId,
                        inputItemId: input.itemId,
                    };
                }
            }
        }
    }
    return null;
};

describe('useLayoutStore', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('adds a block with ports and position', () => {
        const recipe = DSP_DATA.recipes[0];
        useLayoutStore.getState().addBlock(recipe.id, { x: 10, y: 20 });

        const [node] = useLayoutStore.getState().nodes;
        expect(node.data.recipeId).toBe(recipe.id);
        expect(node.position).toEqual({ x: 10, y: 20 });
        expect(node.data.inputPorts).toHaveLength(recipe.inputs.length);
        expect(node.data.outputPorts).toHaveLength(recipe.outputs.length);
    });

    it('prevents self-connections', () => {
        const recipe = DSP_DATA.recipes[0];
        useLayoutStore.getState().addBlock(recipe.id, { x: 0, y: 0 });

        const [node] = useLayoutStore.getState().nodes;
        const sourceHandle = node.data.outputPorts[0]?.id || null;
        const targetHandle = node.data.inputPorts[0]?.id || null;

        useLayoutStore.getState().onConnect({
            source: node.id,
            target: node.id,
            sourceHandle,
            targetHandle,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(0);
    });

    it('adds a valid connection between compatible ports', () => {
        const match = findConnectableRecipes();
        if (!match) throw new Error('No compatible recipes found for connection test');

        const { outputRecipe, inputRecipe, itemId } = match;
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 100, y: 100 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        const sourceHandle = sourceNode.data.outputPorts.find(port => port.itemId === itemId)?.id || null;
        const targetHandle = targetNode.data.inputPorts.find(port => port.itemId === itemId)?.id || null;

        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle,
            targetHandle,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(1);
    });

    it('rejects mismatched item connections', () => {
        const mismatch = findMismatchedRecipes();
        if (!mismatch) throw new Error('No mismatched recipes found for connection test');

        const { outputRecipe, inputRecipe, outputItemId, inputItemId } = mismatch;
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 100, y: 100 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        const sourceHandle = sourceNode.data.outputPorts.find(port => port.itemId === outputItemId)?.id || null;
        const targetHandle = targetNode.data.inputPorts.find(port => port.itemId === inputItemId)?.id || null;

        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle,
            targetHandle,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(0);
    });

    it('prevents multiple connections to the same target port', () => {
        const match = findConnectableRecipes();
        if (!match) throw new Error('No compatible recipes found for connection test');

        const { outputRecipe, inputRecipe, itemId } = match;
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 100, y: 100 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        const sourceHandle = sourceNode.data.outputPorts.find(port => port.itemId === itemId)?.id || null;
        const targetHandle = targetNode.data.inputPorts.find(port => port.itemId === itemId)?.id || null;

        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle,
            targetHandle,
        });

        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle,
            targetHandle,
        });

        expect(useLayoutStore.getState().edges).toHaveLength(1);
    });

    it('sets the active port when onPortClick is called', () => {
        const recipe = DSP_DATA.recipes[0];
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
        const match = findConnectableRecipes();
        if (!match) throw new Error('No compatible recipes found');
        const { outputRecipe, inputRecipe, itemId } = match;

        // Add source block
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        const [sourceNode] = useLayoutStore.getState().nodes;
        const sourcePortId = sourceNode.data.outputPorts.find(p => p.itemId === itemId)!.id;

        // Create and connect input block
        useLayoutStore.getState().createAndConnect(
            inputRecipe.id,
            { x: 300, y: 0 },
            { nodeId: sourceNode.id, portId: sourcePortId, type: 'output' }
        );

        expect(useLayoutStore.getState().nodes).toHaveLength(2);
        expect(useLayoutStore.getState().edges).toHaveLength(1);

        const edge = useLayoutStore.getState().edges[0];
        expect(edge.source).toBe(sourceNode.id);
        expect(edge.sourceHandle).toBe(sourcePortId);
    });

    it('calculates flow immediately on connect (Smoke Test)', () => {
        const match = findConnectableRecipes();
        if (!match) throw new Error('No compatible recipes found');
        const { outputRecipe, inputRecipe, itemId } = match;

        // 1. Setup Source (High Rate) and Target
        useLayoutStore.getState().addBlock(outputRecipe.id, { x: 0, y: 0 });
        useLayoutStore.getState().addBlock(inputRecipe.id, { x: 200, y: 0 });

        const [sourceNode, targetNode] = useLayoutStore.getState().nodes;
        const sourcePort = sourceNode.data.outputPorts.find(p => p.itemId === itemId)!;
        const targetPort = targetNode.data.inputPorts.find(p => p.itemId === itemId)!;

        // Ensure source has rate
        expect(sourcePort.rate).toBeGreaterThan(0);

        // 2. Connect
        useLayoutStore.getState().onConnect({
            source: sourceNode.id,
            sourceHandle: sourcePort.id,
            target: targetNode.id,
            targetHandle: targetPort.id,
        });

        // 3. Assert Flow
        const edge = useLayoutStore.getState().edges[0];
        const data = edge.data as any;
        expect(data.flowRate).toBeGreaterThan(0);
        // Should catch the "0/x" bug if recalculateFlows fails to propagate
        expect(data.flowRate).toBe(Math.min(sourcePort.rate, data.capacity));
    });
});
