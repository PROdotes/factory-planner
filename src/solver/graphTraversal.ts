/**
 * ROLE: Factory Utility
 * PURPOSE: Traverses the factory graph to find dependencies and consumers.
 * RELATION: Core logic for Focus Mode.
 */

import { FactoryLayout } from '../factory/core/factory.types';

export function getUpstreamChain(nodeId: string, layout: FactoryLayout): Set<string> {
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        // Find all connections where target is current
        layout.connections.forEach(conn => {
            if (conn.targetBlockId === currentId) {
                stack.push(conn.sourceBlockId);
            }
        });
    }

    return visited;
}

export function getDownstreamChain(nodeId: string, layout: FactoryLayout): Set<string> {
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        // Find all connections where source is current
        layout.connections.forEach(conn => {
            if (conn.sourceBlockId === currentId) {
                stack.push(conn.targetBlockId);
            }
        });
    }

    return visited;
}

export function getFocusSet(nodeId: string, layout: FactoryLayout): Set<string> {
    const upstream = getUpstreamChain(nodeId, layout);
    const downstream = getDownstreamChain(nodeId, layout);

    // Combine both
    const combined = new Set<string>([...upstream, ...downstream]);
    return combined;
}

export function getNeighborSet(nodeId: string, layout: FactoryLayout): Set<string> {
    const neighbors = new Set<string>([nodeId]);

    layout.connections.forEach(conn => {
        if (conn.targetBlockId === nodeId) {
            neighbors.add(conn.sourceBlockId);
        }
        if (conn.sourceBlockId === nodeId) {
            neighbors.add(conn.targetBlockId);
        }
    });

    return neighbors;
}
