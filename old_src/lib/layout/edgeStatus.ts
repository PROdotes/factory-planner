import { Edge } from 'reactflow';
import { beltItemsPerUnit } from '@/lib/rates';
import { GameDefinition } from '@/types/game';
import { findChannelConflicts, getChannelSegments } from '@/lib/validation/conflictDetection';
import { getLaneCount, Point } from '@/lib/router/channelRouter';
import { BeltEdgeData, Block, BlockNode, CollisionRect, EdgeStatus, Port, SplitterNodeData, getPortPosition } from '@/types/block';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

export const getPort = (node: BlockNode, handleId: string | null, type: 'input' | 'output'): Port | undefined => {
    if (!handleId) return undefined;
    const data = node.data as Block | SplitterNodeData;
    const ports = type === 'output' ? data.outputPorts : data.inputPorts;
    return ports?.find((port: Port) => port.id === handleId);
};

const sameCollisionRects = (left: CollisionRect[] | undefined, right: CollisionRect[] | undefined) => {
    if (left === right) return true;
    if (!left || !right) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
        const a = left[i];
        const b = right[i];
        if (!a || !b) return false;
        if (Math.abs(a.x - b.x) > LAYOUT_METRICS.debug.collisionEpsilon) return false;
        if (Math.abs(a.y - b.y) > LAYOUT_METRICS.debug.collisionEpsilon) return false;
        if (Math.abs(a.width - b.width) > LAYOUT_METRICS.debug.collisionEpsilon) return false;
        if (Math.abs(a.height - b.height) > LAYOUT_METRICS.debug.collisionEpsilon) return false;
    }
    return true;
};

export const updateEdgeStatus = (
    edge: Edge,
    nodes: BlockNode[],
    game: GameDefinition,
    overrideFlow?: number,
    overrideDemand?: number,
    flowMode: boolean = false
): Edge => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const sourcePort = getPort(sourceNode, edge.sourceHandle ?? null, 'output');
    const targetPort = getPort(targetNode, edge.targetHandle ?? null, 'input');

    if (!sourcePort || !targetPort) return edge;

    const edgeData = (edge.data as BeltEdgeData) || {
        beltId: game.belts[0].id,
        capacity: beltItemsPerUnit(game.belts[0], game.settings.rateUnit),
        flowRate: 0,
        demandRate: 0,
        status: 'ok',
        itemId: sourcePort.itemId
    };

    const belt = game.belts.find((beltTier) => beltTier.id === edgeData.beltId) || game.belts[0];
    const capacity = beltItemsPerUnit(belt, game.settings.rateUnit);

    const supplyRate = overrideFlow !== undefined ? overrideFlow : (sourcePort.currentRate !== undefined ? sourcePort.currentRate : sourcePort.rate);
    const demandRate = overrideDemand !== undefined ? overrideDemand : targetPort.rate;

    let status: EdgeStatus = 'ok';

    if (sourcePort.itemId !== targetPort.itemId && targetPort.itemId !== 'any' && sourcePort.itemId !== 'any') {
        status = 'mismatch';
    }

    if (status === 'ok' && demandRate > supplyRate + LAYOUT_METRICS.debug.rateEpsilon) {
        status = 'underload';
    }

    let collisionRects: CollisionRect[] = [];

    if (status === 'ok' || status === 'underload') {
        const p1 = getPortPosition(sourceNode.data, sourceNode.position, sourcePort, flowMode, game);
        const p2 = getPortPosition(targetNode.data, targetNode.position, targetPort, flowMode, game);
        const midX = p1.x + (p2.x - p1.x) * 0.5;

        const fallbackPoints: Point[] = [
            { x: p1.x, y: p1.y },
            { x: midX, y: p1.y },
            { x: midX, y: p2.y },
            { x: p2.x, y: p2.y }
        ];
        const pointsFromEdge = (edge.data as { points?: Point[] } | undefined)?.points;
        const pointsLocal = pointsFromEdge && pointsFromEdge.length >= 2 ? pointsFromEdge : fallbackPoints;

        const lanes = getLaneCount(supplyRate, capacity);
        const width = (lanes - 1) * LAYOUT_METRICS.belt.standardLaneSpacing
            + LAYOUT_METRICS.belt.standardFoundationBase
            + LAYOUT_METRICS.belt.standardFoundationPadding;

        const segments = getChannelSegments(pointsLocal, width);
        collisionRects = segments;

        // Expose the routing points used to compute collision rects so
        // debug tools can visualize exact solver geometry.
        // (points is an array of {x,y})

        const conflicts = findChannelConflicts(pointsLocal, width, nodes);
        const relevantConflicts = conflicts.filter((conflict) => conflict.id !== sourceNode.id && conflict.id !== targetNode.id);

        if (relevantConflicts.length > 0) {
            status = 'conflict';
        }
    }

    const nextData: BeltEdgeData = {
        ...edgeData,
        capacity,
        flowRate: supplyRate,
        demandRate,
        status,
        collisionRects
    };

    // Stability: Only return new object if values actually changed
    // We check rates with a small epsilon to avoid float jitter loops
    if (edge.data &&
        edge.data.capacity === nextData.capacity &&
        Math.abs(edge.data.flowRate - nextData.flowRate) < LAYOUT_METRICS.debug.rateEpsilon &&
        Math.abs(edge.data.demandRate - nextData.demandRate) < LAYOUT_METRICS.debug.rateEpsilon &&
        edge.data.status === nextData.status &&
        edge.data.itemId === nextData.itemId &&
        sameCollisionRects(edge.data.collisionRects, nextData.collisionRects)) {
        return edge;
    }

    return {
        ...edge,
        data: nextData
    };
};
