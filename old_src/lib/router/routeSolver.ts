
import { Edge } from 'reactflow';
import { defaultBeltCapacity } from '@/lib/rates';
import { Block, BlockNode, Port, SplitterNodeData, getPortPosition, getBeltFoundationWidth, getCalculatedSize } from '@/types/block';
import { GameDefinition } from '@/types/game';
import { Pathfinder, Obstacle } from './pathfinder';
import { Point } from './channelRouter';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

/**
 * Recalculates paths for all edges in the layout.
 * Ensures paths respect obstacles and avoid same-alignment overlap.
 */
function isPathEqual(p1?: Point[], p2?: Point[]): boolean {
    if (!p1 || !p2) return p1 === p2;
    if (p1.length !== p2.length) return false;
    for (let i = 0; i < p1.length; i++) {
        if (p1[i].x !== p2[i].x || p1[i].y !== p2[i].y) return false;
    }
    return true;
}

export function solveAllRoutes(nodes: BlockNode[], edges: Edge[], game: GameDefinition, onlyRouteNodeId?: string, flowMode?: boolean): Edge[] {
    const obstacles: Obstacle[] = nodes.map(node => {
        const size = getCalculatedSize(node.data, Boolean(flowMode), game);
        return {
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            width: size.width,
            height: size.height
        };
    });

    const segments: { p1: Point, p2: Point, dir: 'h' | 'v', width: number }[] = [];

    // Separate edges into "Fixed" and "To Solve"
    const staticEdges: Edge[] = [];
    const dynamicEdges: Edge[] = [];

    edges.forEach(edge => {
        const isDynamic = !onlyRouteNodeId || edge.source === onlyRouteNodeId || edge.target === onlyRouteNodeId;
        if (isDynamic) {
            dynamicEdges.push(edge);
        } else {
            staticEdges.push(edge);
        }
    });

    // 1. Add static segments to the occupancy map
    staticEdges.forEach(edge => {
        const width = getEdgeWidth(edge, flowMode, game);
        const points = (edge.data as { points?: Point[] } | undefined)?.points;

        if (points && points.length >= 2) {
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const dir = Math.abs(p1.y - p2.y) < 1 ? 'h' : 'v';
                segments.push({ p1, p2, dir, width });
            }
        }
    });

    // 2. Solve dynamic edges in a deterministic order
    const sortedDynamic = dynamicEdges.sort((a, b) => a.id.localeCompare(b.id));
    const solvedDynamic = sortedDynamic.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode || !edge.sourceHandle || !edge.targetHandle) {
            return edge;
        }

        const sourceData = sourceNode.data as Block | SplitterNodeData;
        const targetData = targetNode.data as Block | SplitterNodeData;

        const sourcePort = sourceData.outputPorts?.find((p: Port) => p.id === edge.sourceHandle);
        const targetPort = targetData.inputPorts?.find((p: Port) => p.id === edge.targetHandle);

        if (!sourcePort || !targetPort) return edge;

        const start = getPortPosition(sourceData, sourceNode.position, sourcePort, Boolean(flowMode), game);
        const end = getPortPosition(targetData, targetNode.position, targetPort, Boolean(flowMode), game);

        // ADAPTIVE BREAKOUT LOGIC
        // Reduce breakout distance if the target is too close, preventing overshoot.
        const maxDist = flowMode ? LAYOUT_METRICS.routing.breakoutDistance.flow : LAYOUT_METRICS.routing.breakoutDistance.standard;
        let startDist: number = maxDist;
        let endDist: number = maxDist;

        // X-Axis Proximity Check
        if (sourcePort.side === 'left' || sourcePort.side === 'right') {
            const dx = Math.abs(end.x - start.x);
            if (dx < startDist * 2) startDist = Math.max(LAYOUT_METRICS.routing.breakoutDistance.minDistance, dx / 2 - LAYOUT_METRICS.routing.breakoutDistance.shrinkOffset);
        }
        if (targetPort.side === 'left' || targetPort.side === 'right') {
            const dx = Math.abs(end.x - start.x);
            if (dx < endDist * 2) endDist = Math.max(LAYOUT_METRICS.routing.breakoutDistance.minDistance, dx / 2 - LAYOUT_METRICS.routing.breakoutDistance.shrinkOffset);
        }

        // Y-Axis Proximity Check
        if (sourcePort.side === 'top' || sourcePort.side === 'bottom') {
            const dy = Math.abs(end.y - start.y);
            if (dy < startDist * 2) startDist = Math.max(LAYOUT_METRICS.routing.breakoutDistance.minDistance, dy / 2 - LAYOUT_METRICS.routing.breakoutDistance.shrinkOffset);
        }
        if (targetPort.side === 'top' || targetPort.side === 'bottom') {
            const dy = Math.abs(end.y - start.y);
            if (dy < endDist * 2) endDist = Math.max(LAYOUT_METRICS.routing.breakoutDistance.minDistance, dy / 2 - LAYOUT_METRICS.routing.breakoutDistance.shrinkOffset);
        }

        const getBreakout = (p: Point, side: string, dist: number) => {
            if (side === 'left') return { x: p.x - dist, y: p.y };
            if (side === 'right') return { x: p.x + dist, y: p.y };
            if (side === 'top') return { x: p.x, y: p.y - dist };
            if (side === 'bottom') return { x: p.x, y: p.y + dist };
            return { ...p };
        };

        const breakoutStart = getBreakout(start, sourcePort.side, startDist);
        const breakoutEnd = getBreakout(end, targetPort.side, endDist);

        const currentBeltWidth = getEdgeWidth(edge, flowMode, game);

        const pather = new Pathfinder(obstacles, segments, currentBeltWidth, [edge.source, edge.target]);
        const midPath = pather.findPath(breakoutStart, breakoutEnd);

        // Final path
        const path = [start, ...midPath, end];

        // Remove redundant collinear points
        const simplified: Point[] = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];
            // If horizontal: y is const
            if (prev.y === curr.y && curr.y === next.y) continue;
            // If vertical: x is const
            if (prev.x === curr.x && curr.x === next.x) continue;
            simplified.push(curr);
        }
        simplified.push(path[path.length - 1]);

        // Add to segments
        for (let i = 0; i < simplified.length - 1; i++) {
            const p1 = simplified[i];
            const p2 = simplified[i + 1];
            const dir = Math.abs(p1.y - p2.y) < 1 ? 'h' : 'v';
            segments.push({ p1, p2, dir, width: currentBeltWidth });
        }

        const existingPoints = (edge.data as { points?: Point[] } | undefined)?.points;
        if (isPathEqual(existingPoints, simplified)) {
            return edge;
        }

        return {
            ...edge,
            data: {
                ...edge.data,
                points: simplified
            }
        };
    });

    const resultMap = new Map<string, Edge>();
    staticEdges.forEach(e => resultMap.set(e.id, e));
    solvedDynamic.forEach(e => resultMap.set(e.id, e));

    return edges.map(e => resultMap.get(e.id) || e);
}

function getEdgeWidth(edge: Edge, flowMode?: boolean, game?: GameDefinition): number {
    const flowRate = (edge.data as { flowRate?: number } | undefined)?.flowRate ?? 0;
    const capacity = (edge.data as { capacity?: number } | undefined)?.capacity
        ?? (game ? defaultBeltCapacity(game.settings.rateUnit) : 60);
    const laneCount = Number.isFinite(flowRate) && Number.isFinite(capacity) && capacity > 0
        ? Math.max(1, Math.ceil(flowRate / capacity))
        : 1;

    return getBeltFoundationWidth(laneCount, Boolean(flowMode));
}
