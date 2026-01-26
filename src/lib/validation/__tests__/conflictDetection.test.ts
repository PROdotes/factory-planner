import { describe, it, expect } from 'vitest';
import { findChannelConflicts, findNodeConflicts } from '../conflictDetection';
import { BlockNode } from '@/types/block';
import { Point } from '@/lib/router/channelRouter';

describe('Conflict Detection', () => {

    const createNode = (id: string, x: number, y: number, w: number, h: number): BlockNode => ({
        id,
        type: 'block',
        position: { x, y },
        data: {
            size: { width: w, height: h }
        } as any,
        origin: [0, 0]
    });

    const OBSTACLE = createNode('obstacle', 50, 50, 20, 20); // Rect: x=[50,70], y=[50,70]

    // Vertical path at x=40, from y=0 to y=100
    const PATH: Point[] = [{ x: 40, y: 0 }, { x: 40, y: 100 }];

    it('ignores narrow channels (width 10) that do not overlap', () => {
        // Belt X range: [35, 45]. Obstacle starts 50. Gap 5.
        const conflicts = findChannelConflicts(PATH, 10, [OBSTACLE]);
        expect(conflicts).toHaveLength(0);
    });

    it('detects overlap with wide channels (width 30)', () => {
        // Belt X range: [25, 55]. Obstacle starts 50. Overlap 5.
        const conflicts = findChannelConflicts(PATH, 30, [OBSTACLE]);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].id).toBe('obstacle');
    });

    it('detects node-to-node conflicts', () => {
        const n1 = createNode('n1', 0, 0, 100, 100);
        const n2 = createNode('n2', 50, 50, 100, 100); // Overlaps
        const n3 = createNode('n3', 200, 200, 50, 50); // Separate

        const conflicts = findNodeConflicts([n1, n2, n3]);
        expect(conflicts.has('n1')).toBe(true);
        expect(conflicts.has('n2')).toBe(true);
        expect(conflicts.has('n3')).toBe(false);
    });
});
