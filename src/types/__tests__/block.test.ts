import { describe, it, expect } from 'vitest';
import { getPortPosition, Block, Port } from '../block';

const buildBlock = (port: Port): Block => ({
    id: 'block-1',
    name: 'Test Block',
    recipeId: 'test-recipe',
    targetRate: 60,
    position: { x: 10, y: 20 },
    size: { width: 100, height: 50 },
    machineCount: 1,
    actualRate: 60,
    inputPorts: port.type === 'input' ? [port] : [],
    outputPorts: port.type === 'output' ? [port] : [],
});

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

        const position = getPortPosition(buildBlock(port), port);
        expect(position).toEqual({ x: 60, y: 20 });
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

        const position = getPortPosition(buildBlock(port), port);
        expect(position).toEqual({ x: 35, y: 70 });
    });

    it('calculates left port positions', () => {
        const port: Port = {
            id: 'p3',
            type: 'input',
            itemId: 'iron-ore',
            rate: 10,
            side: 'left',
            offset: 1,
        };

        const position = getPortPosition(buildBlock(port), port);
        expect(position).toEqual({ x: 10, y: 70 });
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

        const position = getPortPosition(buildBlock(port), port);
        expect(position).toEqual({ x: 110, y: 20 });
    });
});
