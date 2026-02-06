import { describe, it, expect } from 'vitest';
import { updateEdgeBeltTier } from '../layoutFlowSolver';
import { Edge } from 'reactflow';
import { BlockNode } from '@/types/block';
import { GameDefinition } from '@/types/game';

const MOCK_GAME: GameDefinition = {
    id: 'dsp',
    name: 'Test',
    version: '1.0',
    items: [],
    recipes: [],
    machines: [],
    belts: [
        { id: 'belt-1', name: 'Belt Mk.1', tier: 1, itemsPerSecond: 6, color: '#333' }
    ],
    settings: {
        rateUnit: 'minute',
        lanesPerBelt: 1,
        hasSpeedModifiers: false,
        gridSize: 1
    }
};

describe('layoutFlowSolver', () => {
    it('updateEdgeBeltTier does not mutate input edge data', () => {
        const game = MOCK_GAME;
        const edge: Edge = {
            id: 'e-1',
            source: 'a',
            target: 'b',
            data: {
                beltId: game.belts[0].id,
                capacity: 60,
                flowRate: 0,
                demandRate: 0,
                status: 'ok',
                itemId: 'any'
            }
        };
        const nodes: BlockNode[] = [
            {
                id: 'n1',
                type: 'splitter',
                position: { x: 0, y: 0 },
                data: {
                    id: 'n1',
                    type: 'splitter',
                    priority: 'balanced',
                    inputPorts: [{ id: 'in', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }],
                    outputPorts: [{ id: 'out', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }]
                }
            } as BlockNode,
            {
                id: 'n2',
                type: 'splitter',
                position: { x: 100, y: 0 },
                data: {
                    id: 'n2',
                    type: 'splitter',
                    priority: 'balanced',
                    inputPorts: [{ id: 'in', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }],
                    outputPorts: [{ id: 'out', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }]
                }
            } as BlockNode
        ];

        const originalData = structuredClone(edge.data as object);
        edge.source = 'n1';
        edge.target = 'n2';
        edge.sourceHandle = 'out';
        edge.targetHandle = 'in';
        const updated = updateEdgeBeltTier(edge, nodes, game);

        expect(edge.data).toEqual(originalData);
        expect(updated).not.toBe(edge);
    });
});
