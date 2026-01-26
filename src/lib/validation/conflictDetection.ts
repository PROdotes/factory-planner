import { BlockNode } from '@/types/block';
import { Point } from '@/lib/router/channelRouter';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Checks if nodes (Blocks/Splitters) intersect with each other.
 * Returns a Set of Node IDs that are in conflict.
 */
export function findNodeConflicts(nodes: BlockNode[]): Set<string> {
    const overlapping = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];

            const r1 = getNodeRect(n1);
            const r2 = getNodeRect(n2);

            if (r1 && r2 && isIntersecting(r1, r2)) {
                overlapping.add(n1.id);
                overlapping.add(n2.id);
            }
        }
    }

    return overlapping;
}

function getNodeRect(node: BlockNode): Rect | null {
    const data = node.data as any;
    if (!data.size) return null;
    return {
        x: node.position.x,
        y: node.position.y,
        width: data.size.width,
        height: data.size.height
    };
}

/**
 * Shared utility to get the actual collision rectangles for a channel.
 * Used by both the logic engine and the debug renderer.
 */
export function getChannelSegments(points: Point[], width: number): Rect[] {
    const segments: Rect[] = [];
    const halfWidth = width / 2;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const isHorizontal = Math.abs(p1.y - p2.y) < 0.1;

        // Determine if endpoints are internal corners (connected to other segments)
        const isP1Corner = i > 0;
        const isP2Corner = i < points.length - 2;

        if (isHorizontal) {
            let minX = Math.min(p1.x, p2.x);
            let maxX = Math.max(p1.x, p2.x);

            // Extend if corner
            if (p1.x < p2.x) { // p1 is left (min), p2 is right (max)
                if (isP1Corner) minX -= halfWidth;
                if (isP2Corner) maxX += halfWidth;
            } else { // p2 is left (min), p1 is right (max)
                if (isP2Corner) minX -= halfWidth;
                if (isP1Corner) maxX += halfWidth;
            }

            segments.push({
                x: minX,
                y: p1.y - halfWidth,
                width: maxX - minX,
                height: width
            });
        } else {
            let minY = Math.min(p1.y, p2.y);
            let maxY = Math.max(p1.y, p2.y);

            // Extend if corner
            if (p1.y < p2.y) { // p1 is top (min), p2 is bottom (max)
                if (isP1Corner) minY -= halfWidth;
                if (isP2Corner) maxY += halfWidth;
            } else { // p2 is top (min), p1 is bottom (max)
                if (isP2Corner) minY -= halfWidth;
                if (isP1Corner) maxY += halfWidth;
            }

            segments.push({
                x: p1.x - halfWidth,
                y: minY,
                width: width,
                height: maxY - minY
            });
        }
    }
    return segments;
}

/**
 * Checks if a Channel (defined by points and a total width)
 * intersects with any of the valid nodes.
 */
export function findChannelConflicts(points: Point[], width: number, nodes: BlockNode[]): BlockNode[] {
    if (points.length < 2) return [];

    const conflicts: BlockNode[] = [];
    const segments = getChannelSegments(points, width);

    // 2. Check against all Nodes
    for (const node of nodes) {
        const blockRect = getNodeRect(node);
        if (!blockRect) continue;

        let hasHit = false;
        for (const seg of segments) {
            if (isIntersecting(seg, blockRect)) {
                hasHit = true;
                break;
            }
        }

        if (hasHit) {
            conflicts.push(node);
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
