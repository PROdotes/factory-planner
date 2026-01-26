import { describe, it, expect } from 'vitest';
import { getPortPosition, Block, Port } from '../block';

const buildBlock = (port: Port): Block => ({
    id: 'block-1',
    name: 'Test Block',
    recipeId: 'test-recipe',
    targetRate: 60,
    calculationMode: 'output',
    size: { width: 100, height: 50 },
    machineCount: 1,
    actualRate: 60,
    inputPorts: port.type === 'input' ? [port] : [],
    outputPorts: port.type === 'output' ? [port] : [],
    efficiency: 1.0
} as Block);

const NODE_POS = { x: 10, y: 20 };

describe('getPortPosition', () => {
    it('calculates top port positions', () => {
        const port: Port = {
            id: 'p1',
            type: 'input',
            itemId: 'iron-ore',
            rate: 10,
            side: 'top',
            offset: 0.5,
        };

        const position = getPortPosition(buildBlock(port), NODE_POS, port);
        // x = 10 + 100 * 0.5 = 60
        // y = 20 - 4 = 16
        expect(position).toEqual({ x: 60, y: 16 });
    });

    it('calculates bottom port positions', () => {
        const port: Port = {
            id: 'p2',
            type: 'output',
            itemId: 'iron-ore',
            rate: 10,
            side: 'bottom',
            offset: 0.25,
        };

        const position = getPortPosition(buildBlock(port), NODE_POS, port);
        // x = 10 + 100 * 0.25 = 35
        // y = 20 + 50 + 4 = 74
        expect(position).toEqual({ x: 35, y: 74 });
    });

    it('calculates left port positions', () => {
        const port: Port = {
            id: 'p3',
            type: 'input',
            itemId: 'iron-ore',
            rate: 10,
            side: 'left',
            offset: 0, // Ignored for side ports now
        };

        const position = getPortPosition(buildBlock(port), NODE_POS, port);
        // Building Logic: HEADER + LABEL + (Index * RowHeight) + HalfRow
        // 98 + 24 + (0) + 20 = 142
        // y = 20 + 142 = 162
        // x = 10 - 4 = 6
        expect(position).toEqual({ x: 6, y: 162 });
    });

    it('calculates right port positions', () => {
        const port: Port = {
            id: 'p4',
            type: 'output',
            itemId: 'iron-ore',
            rate: 10,
            side: 'right',
            offset: 0,
        };

        const position = getPortPosition(buildBlock(port), NODE_POS, port);
        // Same Y logic as left for index 0 -> 162
        // x = 10 + 100 + 4 = 114
        expect(position).toEqual({ x: 114, y: 162 });
    });
});
