import { Edge } from 'reactflow';
import { BlockNode } from '@/types/block';

export const getTargetDemand = (
    targetNodeId: string,
    targetHandleId: string,
    nodes: BlockNode[],
    edges: Edge[],
    visited: Set<string> = new Set()
): number => {
    const key = `${targetNodeId}-${targetHandleId}-input`;
    if (visited.has(key)) return 0;
    visited.add(key);

    const node = nodes.find((candidate) => candidate.id === targetNodeId);
    if (!node) return 0;

    if (node.type === 'block') {
        const data = node.data as unknown as { inputPorts?: Array<{ id: string; rate?: number }> };
        const port = data.inputPorts?.find((p) => p.id === targetHandleId);
        return port?.rate ?? 0;
    }

    if (node.type === 'splitter') {
        const data = node.data as unknown as { outputPorts?: Array<{ id: string }> };
        const totalOutDemand = data.outputPorts?.reduce((sum: number, port: { id: string }) =>
            sum + getDownstreamDemand(node.id, port.id, nodes, edges, visited), 0
        ) ?? 0;
        const incoming = edges.filter((edge) => edge.target === node.id);
        return totalOutDemand / Math.max(1, incoming.length);
    }

    return 0;
};

export const getDownstreamDemand = (
    nodeId: string,
    portId: string,
    nodes: BlockNode[],
    edges: Edge[],
    visited: Set<string> = new Set()
): number => {
    const key = `${nodeId}-${portId}-output`;
    if (visited.has(key)) return 0;
    visited.add(key);

    const outgoingEdges = edges.filter((edge) => edge.source === nodeId && edge.sourceHandle === portId);
    if (outgoingEdges.length === 0) return 0;

    return outgoingEdges.reduce((sum, edge) => {
        return sum + getTargetDemand(edge.target, edge.targetHandle!, nodes, edges, visited);
    }, 0);
};
