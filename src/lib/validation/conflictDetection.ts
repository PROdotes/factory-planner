import { Block } from '@/types/block';
import { Point } from '@/lib/router/channelRouter';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Checks if a Channel (defined by points and a total width)
 * intersects with any of the valid blocks.
 */
export function findChannelConflicts(points: Point[], width: number, blocks: Block[]): Block[] {
    if (points.length < 2) return [];

    const conflicts: Block[] = [];
    const segments = [];

    // 1. Build Segment Rects for the collision
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        // Determine bounds
        const xMin = Math.min(p1.x, p2.x);
        const xMax = Math.max(p1.x, p2.x);
        const yMin = Math.min(p1.y, p2.y);
        const yMax = Math.max(p1.y, p2.y);

        // Expand by half-width to get the full footprint
        // Note: For Manhattan segments, one dimension is just 'width', the other is 'length + width'
        // But to be safe and cover corners, we expand the AABB.

        let rect: Rect;

        // Horizontal Segment
        if (Math.abs(p1.y - p2.y) < 0.1) {
            rect = {
                x: xMin, // Start X
                y: yMin - width / 2, // Center Y
                width: xMax - xMin, // Length
                height: width
            };
        }
        // Vertical Segment
        else {
            rect = {
                x: xMin - width / 2, // Center X
                y: yMin,
                width: width,
                height: yMax - yMin // Length
            };
        }
        segments.push(rect);
    }

    // 2. Check against all Blocks
    for (const block of blocks) {
        // Block Rect
        // ReactFlow positions are Top-Left
        const blockRect: Rect = {
            x: block.position.x,
            y: block.position.y,
            width: block.size.width,
            height: block.size.height
        };

        // Simple shrinking of block rect to be "forgiving"?
        // e.g. Ports are on the edge, so we allow touching the edge.
        // Let's shrink the block rect by a small epsilon to allow snap-to-edge connections.
        const PADDING = 2; // Pixels to ignore on edges
        const safeBlockRect: Rect = {
            x: blockRect.x + PADDING,
            y: blockRect.y + PADDING,
            width: blockRect.width - PADDING * 2,
            height: blockRect.height - PADDING * 2
        };

        if (safeBlockRect.width <= 0 || safeBlockRect.height <= 0) continue;

        let hasHit = false;
        for (const seg of segments) {
            if (isIntersecting(seg, safeBlockRect)) {
                hasHit = true;
                break;
            }
        }

        if (hasHit) {
            conflicts.push(block);
        }
    }

    return conflicts;
}

function isIntersecting(r1: Rect, r2: Rect): boolean {
    return !(
        r2.x >= r1.x + r1.width ||
        r2.x + r2.width <= r1.x ||
        r2.y >= r1.y + r1.height ||
        r2.y + r2.height <= r1.y
    );
}
