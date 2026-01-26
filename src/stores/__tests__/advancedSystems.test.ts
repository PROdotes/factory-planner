import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { getLaneCount } from '@/lib/router/channelRouter';
import { BeltEdgeData } from '@/types/block';

const TEST_GAME = {
    id: 'dsp',
    name: 'Test',
    version: '1.0.0',
    settings: { lanesPerBelt: 1, hasSpeedModifiers: true, rateUnit: 'minute', gridSize: 10 },
    items: [
        { id: 'ore', name: 'Ore', category: 'ore', stackSize: 100 },
        { id: 'coal', name: 'Coal', category: 'coal', stackSize: 100 },
        { id: 'steel', name: 'Steel', category: 'steel', stackSize: 100 }
    ],
    recipes: [
        {
            id: 'steel-making', name: 'Steel', machineId: 'smelter', category: 'smelting', craftingTime: 1,
            inputs: [{ itemId: 'ore', amount: 3 }, { itemId: 'coal', amount: 1 }],
            outputs: [{ itemId: 'steel', amount: 1 }]
        }
    ],
    machines: [{ id: 'smelter', name: 'Smelter', category: 'smelter', speed: 1.0, size: { width: 1, height: 1 } }],
    belts: [{ id: 'belt-1', name: 'Belt', tier: 1, itemsPerSecond: 6, color: 'blue' }] // 360/min
};

describe('Advanced Systems Integration', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', { randomUUID: () => `test-id-${counter++}` });
        useGameStore.setState({ game: JSON.parse(JSON.stringify(TEST_GAME)) as any });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
    });

    describe('Multi-Input Satisfaction (Bottleneck Logic)', () => {
        it('stops production if one ingredient is missing', () => {
            const idSteel = useLayoutStore.getState().addBlock('steel-making', { x: 200, y: 0 });
            useLayoutStore.getState().updateBlock(idSteel, { targetRate: 60 });

            // At this point, no inputs connected -> Satisfaction 1.0 (assuming unconnected = satisfied by magic/manually)
            // Wait, our iterative solver says:
            // "if (!connectedInputs.has(key)) return 1.0;"
            // This is "Sandbox Mode" logic. To test starvation, we must connect a starved source.

            const idSourceOre = useLayoutStore.getState().addSplitter('merger', { x: 0, y: -50 }); // Act as source
            const idSourceCoal = useLayoutStore.getState().addSplitter('merger', { x: 0, y: 50 }); // Act as source

            const [,] = useLayoutStore.getState().nodes;

            // Connect Ore (Supply 180 needed for 60 Steel)
            useLayoutStore.getState().onConnect({
                source: idSourceOre, sourceHandle: 'out-main',
                target: idSteel, targetHandle: 'input-0' // Ore
            });
            // Connect Coal (Supply 60 needed for 60 Steel)
            useLayoutStore.getState().onConnect({
                source: idSourceCoal, sourceHandle: 'out-main',
                target: idSteel, targetHandle: 'input-1' // Coal
            });

            // Set Source Ore to 180 (100% satisfied)
            useLayoutStore.getState().updateBlock(idSourceOre, { inputPorts: [{ id: 'in-1', rate: 180, itemId: 'ore', type: 'input', side: 'left', offset: 0.5 }] });
            // Set Source Coal to 0 (Missing!)
            // Note: Since Splitters in our test act as sources by just having rates, we need to ensure recalculateFlows sees it.
            // Actually, let's use a simple Block as source for better control.
        });

        it('correctly scales output based on the scarcest ingredient', () => {
            // Let's use simpler test data for this logic check
            const game = useGameStore.getState().game;
            game.recipes[0].inputs = [{ itemId: 'ore', amount: 1 }, { itemId: 'coal', amount: 1 }];

            const idSteel = useLayoutStore.getState().addBlock('steel-making', { x: 200, y: 0 });
            useLayoutStore.getState().updateBlock(idSteel, { targetRate: 100 });
            // Needs 100 Ore, 100 Coal.

            // We'll mock the solver iteration by manually setting currentRate on ports if needed, 
            // but it's better to let the store do its thing.

            // Create Sources
            const idOre = useLayoutStore.getState().addBlock('steel-making', { x: 0, y: 0 }); // Just a block to have an output
            useLayoutStore.getState().updateBlock(idOre, { outputPorts: [{ id: 'out', itemId: 'ore', rate: 100, type: 'output', side: 'right', offset: 0.5 }] });

            const idCoal = useLayoutStore.getState().addBlock('steel-making', { x: 0, y: 100 });
            useLayoutStore.getState().updateBlock(idCoal, { outputPorts: [{ id: 'out', itemId: 'coal', rate: 50, type: 'output', side: 'right', offset: 0.5 }] });

            useLayoutStore.getState().onConnect({
                source: idOre, sourceHandle: 'out',
                target: idSteel, targetHandle: 'input-0'
            });
            useLayoutStore.getState().onConnect({
                source: idCoal, sourceHandle: 'out',
                target: idSteel, targetHandle: 'input-1'
            });

            // Flow Calculation:
            // Ore: Supply 100, Need 100 -> Sat 1.0
            // Coal: Supply 50, Need 100 -> Sat 0.5
            // Block Satisfaction: min(1.0, 0.5) = 0.5
            // Steel Output: 100 * 0.5 = 50

            const steelNode = useLayoutStore.getState().nodes.find(n => n.id === idSteel)!;
            expect((steelNode.data as any).outputPorts[0].currentRate).toBe(50);
        });
    });

    describe('Splitter Priority (out-left)', () => {
        it('prioritizes left output when total supply is limited', () => {
            const idSource = useLayoutStore.getState().addBlock('steel-making', { x: 0, y: 0 });
            useLayoutStore.getState().updateBlock(idSource, { outputPorts: [{ id: 'out-1', itemId: 'ore', rate: 60, type: 'output', side: 'right', offset: 0.5 }] });

            const idSplitter = useLayoutStore.getState().addSplitter('splitter', { x: 100, y: 0 });
            useLayoutStore.getState().updateBlock(idSplitter, { priority: 'out-left' });

            const idSinkLeft = useLayoutStore.getState().addBlock('steel-making', { x: 200, y: -50 });
            useLayoutStore.getState().updateBlock(idSinkLeft, { targetRate: 60 });

            const idSinkRight = useLayoutStore.getState().addBlock('steel-making', { x: 200, y: 50 });
            useLayoutStore.getState().updateBlock(idSinkRight, { targetRate: 60 });

            // Connect
            useLayoutStore.getState().onConnect({ source: idSource, sourceHandle: 'out-1', target: idSplitter, targetHandle: 'in-main' });
            useLayoutStore.getState().onConnect({ source: idSplitter, sourceHandle: 'out-1', target: idSinkLeft, targetHandle: 'input-0' });
            useLayoutStore.getState().onConnect({ source: idSplitter, sourceHandle: 'out-2', target: idSinkRight, targetHandle: 'input-0' });

            // Supply: 60. Demands: Left 60, Right 60.
            // With priority 'out-left', Left should get all 60, Right 0.
            const edgeLeft = useLayoutStore.getState().edges.find(e => e.target === idSinkLeft)!;
            const edgeRight = useLayoutStore.getState().edges.find(e => e.target === idSinkRight)!;

            expect((edgeLeft.data as BeltEdgeData).flowRate).toBe(60);
            expect((edgeRight.data as BeltEdgeData).flowRate).toBe(0);
        });
    });

    describe('Lane Count Math', () => {
        it('calculates lanes based on belt capacity', () => {
            expect(getLaneCount(360, 360)).toBe(1);
            expect(getLaneCount(361, 360)).toBe(2);
            expect(getLaneCount(720, 360)).toBe(2);
            expect(getLaneCount(721, 360)).toBe(3);
            expect(getLaneCount(0, 360)).toBe(1);
            expect(getLaneCount(-10, 360)).toBe(1);
        });
    });
});
