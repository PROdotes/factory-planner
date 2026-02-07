/**
 * ROLE: Factory Utility
 * PURPOSE: Traverses the factory graph to find dependencies and consumers.
 * RELATION: Core logic for Focus Mode.
 */

import { FactoryLayout } from "../factory/core/factory.types";

export function getUpstreamChain(
  nodeId: string,
  layout: FactoryLayout
): Set<string> {
  const visited = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find all connections where target is current
    layout.connections.forEach((conn) => {
      if (conn.targetBlockId === currentId) {
        stack.push(conn.sourceBlockId);
      }
    });
  }

  return visited;
}

export function getDownstreamChain(
  nodeId: string,
  layout: FactoryLayout
): Set<string> {
  const visited = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find all connections where source is current
    layout.connections.forEach((conn) => {
      if (conn.sourceBlockId === currentId) {
        stack.push(conn.targetBlockId);
      }
    });
  }

  return visited;
}

export function getFocusSet(
  nodeId: string,
  layout: FactoryLayout
): Set<string> {
  const upstream = getUpstreamChain(nodeId, layout);
  const downstream = getDownstreamChain(nodeId, layout);

  // Combine both
  const combined = new Set<string>([...upstream, ...downstream]);
  return combined;
}

export function getNeighborSet(
  nodeId: string,
  layout: FactoryLayout
): Set<string> {
  const neighbors = new Set<string>([nodeId]);

  // Pass 1: Logical Upstream
  const upQueue = [nodeId];
  const upVisited = new Set<string>();
  while (upQueue.length > 0) {
    const currentId = upQueue.shift()!;
    if (upVisited.has(currentId)) continue;
    upVisited.add(currentId);

    layout.connections.forEach((conn) => {
      if (conn.targetBlockId === currentId) {
        neighbors.add(conn.sourceBlockId);
        if (layout.blocks[conn.sourceBlockId]?.type === "logistics") {
          upQueue.push(conn.sourceBlockId);
        }
      }
    });
  }

  // Pass 2: Logical Downstream
  const downQueue = [nodeId];
  const downVisited = new Set<string>();
  while (downQueue.length > 0) {
    const currentId = downQueue.shift()!;
    if (downVisited.has(currentId)) continue;
    downVisited.add(currentId);

    layout.connections.forEach((conn) => {
      if (conn.sourceBlockId === currentId) {
        neighbors.add(conn.targetBlockId);
        if (layout.blocks[conn.targetBlockId]?.type === "logistics") {
          downQueue.push(conn.targetBlockId);
        }
      }
    });
  }

  return neighbors;
}
