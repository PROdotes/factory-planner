
import { Point } from './channelRouter';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

export interface PathNode {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: PathNode | null;
    dir: 'h' | 'v' | null;
}

export interface Obstacle {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

class MinHeap {
    private heap: PathNode[] = [];
    push(node: PathNode) {
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }
    pop(): PathNode | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop();
        const top = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
        return top;
    }
    get length() { return this.heap.length; }
    private bubbleUp(idx: number) {
        while (idx > 0) {
            let p = Math.floor((idx - 1) / 2);
            if (this.heap[idx].f >= this.heap[p].f) break;
            [this.heap[idx], this.heap[p]] = [this.heap[p], this.heap[idx]];
            idx = p;
        }
    }
    private bubbleDown(idx: number) {
        while (true) {
            let l = idx * 2 + 1, r = idx * 2 + 2, s = idx;
            if (l < this.heap.length && this.heap[l].f < this.heap[s].f) s = l;
            if (r < this.heap.length && this.heap[r].f < this.heap[s].f) s = r;
            if (s === idx) break;
            [this.heap[idx], this.heap[s]] = [this.heap[s], this.heap[idx]];
            idx = s;
        }
    }
}

export class Pathfinder {
    private gridSpacing: number = LAYOUT_METRICS.routing.gridSpacing;

    constructor(
        private obstacles: Obstacle[] = [],
        private existingSegments: { p1: Point, p2: Point, dir: 'h' | 'v', width: number }[] = [],
        private currentBeltWidth: number = 16,
        private excludeNodeIds: string[] = []
    ) { }

    private isBlocked(p: Point): boolean {
        const r = this.currentBeltWidth / 2;
        for (const obs of this.obstacles) {
            // Skip the source and target nodes themselves to allow belts to emerge/enter
            if (this.excludeNodeIds.includes(obs.id)) continue;

            if (p.x + r > obs.x + 1 && p.x - r < obs.x + obs.width - 1 &&
                p.y + r > obs.y + 1 && p.y - r < obs.y + obs.height - 1) return true;
        }
        return false;
    }

    private getExistingSegmentCost(p1: Point, p2: Point, dir: 'h' | 'v'): number {
        let cost = 0;
        const r1 = this.currentBeltWidth / 2;
        for (const seg of this.existingSegments) {
            if (seg.dir !== dir) continue;
            const r2 = seg.width / 2;
            const safe = r1 + r2;

            const dist = dir === 'h' ? Math.abs(p1.y - seg.p1.y) : Math.abs(p1.x - seg.p1.x);
            if (dist < safe) {
                // Check if they actually overlap along the length
                const overlapsLength = dir === 'h'
                    ? Math.min(p1.x, p2.x) < Math.max(seg.p1.x, seg.p2.x) && Math.max(p1.x, p2.x) > Math.min(seg.p1.x, seg.p2.x)
                    : Math.min(p1.y, p2.y) < Math.max(seg.p1.y, seg.p2.y) && Math.max(p1.y, p2.y) > Math.min(seg.p1.y, seg.p2.y);

                if (overlapsLength) {
                    // Strict overlap (same line) is very bad
                    if (dist < 1) cost += LAYOUT_METRICS.routing.overlapHardPenalty;
                    // Nearby overlap (touching/merging) is also bad
                    else cost += LAYOUT_METRICS.routing.overlapPenalty;
                }
            }
        }
        return cost;
    }

    findPath(start: Point, end: Point): Point[] {
        // ENFORCE MANHATTAN INTEGERS: Snap world to relative port grid
        const sx = Math.round(start.x);
        const sy = Math.round(start.y);
        const ex = Math.round(end.x);
        const ey = Math.round(end.y);

        const startSnapped = { x: sx, y: sy };
        const endSnapped = { x: ex, y: ey };

        // 1. Z-Shape First (Strictly Integer)
        if (this.isZShapeClear(startSnapped, endSnapped)) {
            const midX = Math.round(sx + (ex - sx) * 0.5);
            return [startSnapped, { x: midX, y: sy }, { x: midX, y: ey }, endSnapped];
        }

        const openSet = new MinHeap();
        openSet.push({ ...startSnapped, g: 0, h: this.dist(startSnapped, endSnapped), f: this.dist(startSnapped, endSnapped), parent: null, dir: null });

        const closedSet = new Map<string, number>();
        const nodeKey = (x: number, y: number) => `${x},${y}`;

        let iters = 0;
        while (openSet.length > 0 && iters < LAYOUT_METRICS.routing.maxIterations) {
            iters++;
            const curr = openSet.pop()!;

            // PERFECT ALIGNMENT CHECK
            if (curr.x === ex && curr.y === ey) return this.reconstructPath(curr, endSnapped);

            const key = nodeKey(curr.x, curr.y);
            if ((closedSet.get(key) || Infinity) <= curr.g) continue;
            closedSet.set(key, curr.g);

            const options: { x: number, y: number, type: 'h' | 'v' }[] = [
                { x: this.gridSpacing, y: 0, type: 'h' },
                { x: -this.gridSpacing, y: 0, type: 'h' },
                { x: 0, y: this.gridSpacing, type: 'v' },
                { x: 0, y: -this.gridSpacing, type: 'v' }
            ];

            // AXIS ALIGNMENT STEP: If we can close the gap in 1 move, do it.
            const dx = ex - curr.x;
            const dy = ey - curr.y;
            if (curr.dir === 'h' && Math.abs(dy) > 0 && Math.abs(dy) < this.gridSpacing) options.push({ x: 0, y: dy, type: 'v' });
            if (curr.dir === 'v' && Math.abs(dx) > 0 && Math.abs(dx) < this.gridSpacing) options.push({ x: dx, y: 0, type: 'h' });

            for (const o of options) {
                const nextPos: Point = { x: curr.x + o.x, y: curr.y + o.y };
                if (this.isBlocked(nextPos)) continue;

                const turn = (curr.dir && curr.dir !== o.type) ? LAYOUT_METRICS.routing.turnPenalty : 0;
                const overlap = this.getExistingSegmentCost(curr, nextPos, o.type);
                const g = curr.g + Math.abs(o.x + o.y) + turn + overlap;

                const nKey = nodeKey(nextPos.x, nextPos.y);
                if ((closedSet.get(nKey) || Infinity) <= g) continue;

                const h = this.dist(nextPos, endSnapped);
                openSet.push({ ...nextPos, g, h, f: g + h, parent: curr, dir: o.type });
            }
        }

        // ABSOLUTE FALLBACK with Smart Z-scan
        // Try multiple mid-points to avoid collisions if A* failed
        const scanOffsets = LAYOUT_METRICS.routing.scanOffsets;
        for (const off of scanOffsets) {
            const midX = Math.round(sx + (ex - sx) * off);
            const tryPts = [startSnapped, { x: midX, y: sy }, { x: midX, y: ey }, endSnapped];

            // rapid check for segment overlap
            let overlapCost = 0;
            for (let i = 0; i < tryPts.length - 1; i++) {
                const p1 = tryPts[i];
                const p2 = tryPts[i + 1];
                const dir = Math.abs(p1.y - p2.y) < 1 ? 'h' : 'v';
                overlapCost += this.getExistingSegmentCost(p1, p2, dir);
            }

            if (overlapCost === 0) {
                return tryPts;
            }
        }

        // Worst case: default to middle
        const fallbackMidX = Math.round(sx + (ex - sx) * 0.5);
        return [startSnapped, { x: fallbackMidX, y: sy }, { x: fallbackMidX, y: ey }, endSnapped];
    }

    private dist(p1: Point, p2: Point) { return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y); }

    private isLineClear(p1: Point, p2: Point): boolean {
        const dist = this.dist(p1, p2);
        if (dist === 0) return true;

        // Check every 'radius' step to ensure we don't skip over obstacles
        // Use strictly integer steps or sufficiently small float steps
        const stepSize = Math.min(this.gridSpacing, this.currentBeltWidth);
        const steps = Math.ceil(dist / stepSize);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const p = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            };
            if (this.isBlocked(p)) return false;
        }
        return true;
    }

    private isZShapeClear(start: Point, end: Point): boolean {
        const midX = Math.round(start.x + (end.x - start.x) * 0.5);
        const pts = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
        for (let i = 0; i < pts.length - 1; i++) {
            if (!this.isLineClear(pts[i], pts[i + 1])) return false;
            const dir: 'h' | 'v' = Math.abs(pts[i].y - pts[i + 1].y) < 1 ? 'h' : 'v';
            if (this.getExistingSegmentCost(pts[i], pts[i + 1], dir) > 0) return false;
        }
        return true;
    }

    private reconstructPath(node: PathNode, end: Point): Point[] {
        const res: Point[] = [end];
        let c: PathNode | null = node;
        while (c) {
            res.unshift({ x: c.x, y: c.y });
            c = c.parent;
        }
        if (res.length <= 2) return res;
        const simplified: Point[] = [res[0]];
        for (let i = 1; i < res.length - 1; i++) {
            const p = res[i - 1], curr = res[i], n = res[i + 1];
            const isH = p.y === curr.y && curr.y === n.y;
            const isV = p.x === curr.x && curr.x === n.x;
            if (!isH && !isV) simplified.push(curr);
        }
        simplified.push(res[res.length - 1]);
        return simplified;
    }
}
