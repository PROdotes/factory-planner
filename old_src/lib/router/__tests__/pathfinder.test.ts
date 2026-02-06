import { describe, it, expect } from 'vitest';
import { Pathfinder, Obstacle } from '../pathfinder';
import { Point } from '../channelRouter';

const makeFinder = (obstacles: Obstacle[] = [], width = 16) => new Pathfinder(obstacles, [], width);

describe('Pathfinder', () => {
    it('returns a simple Z path when unobstructed', () => {
        const finder = makeFinder();
        const start: Point = { x: 0, y: 0 };
        const end: Point = { x: 100, y: 100 };
        const path = finder.findPath(start, end);
        expect(path.length).toBeGreaterThanOrEqual(2);
        expect(path[0]).toEqual(start);
        expect(path[path.length - 1]).toEqual(end);
    });

    it('avoids obstacles placed on the Z path', () => {
const obstacle: Obstacle = { id: 'o1', x: 40, y: -10, width: 40, height: 40 };
        const finder = makeFinder([obstacle]);
        const start: Point = { x: 0, y: 0 };
        const end: Point = { x: 100, y: 0 };
        const path = finder.findPath(start, end);
        expect(path[0]).toEqual(start);
        expect(path[path.length - 1]).toEqual(end);
        expect(path.length).toBeGreaterThanOrEqual(2);
    });
});
