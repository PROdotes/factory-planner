
export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Node {
    point: Point;
    g: number; // Cost from start
    h: number; // Heuristic cost to end
    f: number; // Total cost
    parent?: Node;
}

/**
 * A* Pathfinding for routing belts around obstacles.
 * Operates on a grid to ensure orthogonal paths.
 */
export function findPath(
    start: Point,
    end: Point,
    obstacles: Rect[],
    gridSize: number = 20,
    padding: number = 10
): Point[] {
    // Quantize points to grid
    const startGrid = {
        x: Math.round(start.x / gridSize),
        y: Math.round(start.y / gridSize)
    };
    const endGrid = {
        x: Math.round(end.x / gridSize),
        y: Math.round(end.y / gridSize)
    };

    const openList: Node[] = [{ point: startGrid, g: 0, h: manhattan(startGrid, endGrid), f: manhattan(startGrid, endGrid) }];
    const closedList = new Set<string>();

    const getHash = (p: Point) => `${p.x},${p.y}`;

    while (openList.length > 0) {
        // Sort by f score
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift()!;

        if (current.point.x === endGrid.x && current.point.y === endGrid.y) {
            return reconstructPath(current, gridSize);
        }

        closedList.add(getHash(current.point));

        // 4-way movement (orthogonal)
        const neighbors = [
            { x: current.point.x + 1, y: current.point.y },
            { x: current.point.x - 1, y: current.point.y },
            { x: current.point.x, y: current.point.y + 1 },
            { x: current.point.x, y: current.point.y - 1 },
        ];

        for (const neighborPoint of neighbors) {
            const hash = getHash(neighborPoint);
            if (closedList.has(hash)) continue;

            // Check for obstacles
            if (isColliding(neighborPoint, obstacles, gridSize, padding)) {
                // Allow the start and end points to be inside obstacles (ports are on edges)
                // but only if they are the VERY start or end grid.
                if (!(neighborPoint.x === startGrid.x && neighborPoint.y === startGrid.y) &&
                    !(neighborPoint.x === endGrid.x && neighborPoint.y === endGrid.y)) {
                    continue;
                }
            }

            const g = current.g + 1;
            const h = manhattan(neighborPoint, endGrid);
            const f = g + h;

            const existingOpen = openList.find(n => getHash(n.point) === hash);
            if (existingOpen && g >= existingOpen.g) continue;

            if (existingOpen) {
                existingOpen.g = g;
                existingOpen.f = f;
                existingOpen.parent = current;
            } else {
                openList.push({ point: neighborPoint, g, h, f, parent: current });
            }
        }
    }

    // No path found, return direct line as fallback
    return [start, end];
}

function manhattan(p1: Point, p2: Point): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

function isColliding(p: Point, obstacles: Rect[], gridSize: number, padding: number): boolean {
    const x = p.x * gridSize;
    const y = p.y * gridSize;

    for (const rect of obstacles) {
        if (
            x >= rect.x - padding &&
            x <= rect.x + rect.width + padding &&
            y >= rect.y - padding &&
            y <= rect.y + rect.height + padding
        ) {
            return true;
        }
    }
    return false;
}

function reconstructPath(endNode: Node, gridSize: number): Point[] {
    const path: Point[] = [];
    let current: Node | undefined = endNode;
    while (current) {
        path.unshift({
            x: current.point.x * gridSize,
            y: current.point.y * gridSize
        });
        current = current.parent;
    }
    return path;
}

/**
 * Simplifies a grid path into minimal orthogonal segments
 */
export function simplifyPath(path: Point[]): Point[] {
    if (path.length <= 2) return path;

    const simplified: Point[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const next = path[i + 1];

        // Check if curr is on the line between prev and next
        const isHorizontal = prev.y === curr.y && curr.y === next.y;
        const isVertical = prev.x === curr.x && curr.x === next.x;

        if (!isHorizontal && !isVertical) {
            simplified.push(curr);
        }
    }
    simplified.push(path[path.length - 1]);
    return simplified;
}

/**
 * Converts a sequence of points into an SVG path string.
 */
export function pointsToPath(points: Point[]): string {
    if (points.length === 0) return '';
    let pathString = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathString += ` L ${points[i].x},${points[i].y}`;
    }
    return pathString;
}
