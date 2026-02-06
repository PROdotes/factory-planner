export interface Point {
    x: number;
    y: number;
}

export interface Channel {
    id: string;
    points: Point[];
    throughput: number;
    beltCapacity: number; // MK1: 360/min (DSP), or per game settings
}

/**
 * Calculates the number of parallel lanes required for the given throughput.
 * @param throughput Total items per rate unit.
 * @param beltCapacity Items per belt per rate unit.
 * @returns Number of lanes (always at least 1).
 */
export function getLaneCount(throughput: number, beltCapacity: number): number {
    if (throughput <= 0) return 1;
    return Math.ceil(throughput / beltCapacity);
}

/**
 * Generates orthogonal segments from a list of points.
 * Ensures the path is strictly horizontal/vertical.
 * Assuming points are already orthogonal (Manhattan).
 */
export function getChannelSegments(points: Point[]): { p1: Point, p2: Point, isHorizontal: boolean }[] {
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const isHorizontal = p1.y === p2.y;
        segments.push({ p1, p2, isHorizontal });
    }
    return segments;
}

/**
 * Validates if the path is strictly orthogonal.
 */
export function isOrthogonal(points: Point[]): boolean {
    for (let i = 0; i < points.length - 1; i++) {
        if (points[i].x !== points[i + 1].x && points[i].y !== points[i + 1].y) {
            return false;
        }
    }
    return true;
}
