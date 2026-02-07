/**
 * ROLE: Layout Algorithm
 * PURPOSE: Performs topological auto-layout of factory blocks.
 * RELATION: Called by factoryStore.autoLayout action.
 */

import { BlockBase } from "./core/BlockBase";
import { FactoryGraph } from "./core/FactoryGraph";
import { sortBlockPorts } from "./core/sortBlockPorts";

// Layout constants
const COL_WIDTH = 500;
const ROW_HEIGHT = 320;
const START_X = 100;
const CENTER_Y = 500;
const MAX_COLLISION_ITERATIONS = 10;

interface Connection {
  sourceBlockId: string;
  targetBlockId: string;
}

/**
 * Calculates topological ranks for blocks using iterative propagation.
 * Every block starts at rank 0. If A -> B, then B.rank = max(B.rank, A.rank + 1)
 */
export function calculateBlockRanks(
  blocks: BlockBase[],
  connections: Connection[]
): Map<string, number> {
  const ranks = new Map<string, number>();
  blocks.forEach((b) => ranks.set(b.id, 0));

  // Multiple passes to propagate rank
  // Limit to block count to prevent infinite loops (cyclic graphs)
  for (let i = 0; i < blocks.length; i++) {
    let changed = false;
    connections.forEach((conn) => {
      const rSrc = ranks.get(conn.sourceBlockId) ?? 0;
      const rTgt = ranks.get(conn.targetBlockId) ?? 0;
      if (rTgt <= rSrc) {
        ranks.set(conn.targetBlockId, rSrc + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }

  return ranks;
}

/**
 * Groups blocks by their assigned rank (column).
 */
export function groupBlocksByRank(
  blocks: BlockBase[],
  ranks: Map<string, number>
): Map<number, BlockBase[]> {
  const groups = new Map<number, BlockBase[]>();
  blocks.forEach((b) => {
    const r = ranks.get(b.id) ?? 0;
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(b);
  });
  return groups;
}

/**
 * Builds a map of target block ID -> source block IDs for quick lookup.
 */
function buildIncomingMap(connections: Connection[]): Map<string, string[]> {
  const incomingMap = new Map<string, string[]>();
  connections.forEach((c) => {
    if (!incomingMap.has(c.targetBlockId)) {
      incomingMap.set(c.targetBlockId, []);
    }
    incomingMap.get(c.targetBlockId)!.push(c.sourceBlockId);
  });
  return incomingMap;
}

/**
 * Resolves vertical collisions by pushing blocks apart symmetrically.
 */
function resolveCollisions(group: BlockBase[]): void {
  let hasOverlap = true;
  let iterations = 0;

  while (hasOverlap && iterations < MAX_COLLISION_ITERATIONS) {
    hasOverlap = false;
    // Downward sweep
    for (let i = 0; i < group.length - 1; i++) {
      const upper = group[i];
      const lower = group[i + 1];

      if (lower.position.y < upper.position.y + ROW_HEIGHT) {
        // Overlap detected. Push them apart symmetrically.
        const center = (upper.position.y + lower.position.y) / 2;
        const dist = ROW_HEIGHT / 2 + 1; // +1 buffer

        upper.position.y = center - dist;
        lower.position.y = center + dist;
        hasOverlap = true;
      }
    }
    iterations++;
  }
}

/**
 * Positions blocks within a single column (rank).
 * First rank: keeps relative Y order, stacks centered.
 * Subsequent ranks: positions based on average Y of upstream sources (Lane Logic).
 */
function positionColumn(
  group: BlockBase[],
  rank: number,
  incomingMap: Map<string, string[]>,
  factory: FactoryGraph
): void {
  const x = START_X + rank * COL_WIDTH;

  // Special handling for First Rank (Sources/User Start)
  if (rank === 0) {
    // Keep their relative Y order but stack them neatly centered
    group.sort((a, b) => a.position.y - b.position.y);
    const totalHeight = (group.length - 1) * ROW_HEIGHT;
    group.forEach((block, index) => {
      block.position.x = x;
      block.position.y = CENTER_Y + index * ROW_HEIGHT - totalHeight / 2;
    });
    return;
  }

  // For subsequent ranks: Calculate Ideal Y based on Upstream Sources
  const ideals = new Map<string, number>();

  group.forEach((block) => {
    const sourceIds = incomingMap.get(block.id) || [];
    let runningY = 0;
    let count = 0;

    sourceIds.forEach((srcId) => {
      const srcBlock = factory.blocks.get(srcId);
      if (srcBlock) {
        runningY += srcBlock.position.y;
        count++;
      }
    });

    // If connected, follow sources. If orphan, default to center (500)
    ideals.set(block.id, count > 0 ? runningY / count : CENTER_Y);
    block.position.x = x;
  });

  // Sort by Ideal Y (The "Lane Logic")
  // This ensures blocks with top-inputs float to top, bottom-inputs sink to bottom
  group.sort((a, b) => ideals.get(a.id)! - ideals.get(b.id)!);

  // Initial placement at Ideal Y
  group.forEach((b) => (b.position.y = ideals.get(b.id)!));

  // Resolve collisions
  resolveCollisions(group);
}

/**
 * Performs automatic layout of all blocks in the factory.
 * Uses topological ranking to determine columns and lane logic for vertical positioning.
 */
export function performAutoLayout(factory: FactoryGraph): void {
  const blocks = Array.from(factory.blocks.values());
  if (blocks.length === 0) return;

  // 1. Calculate topological ranks
  const ranks = calculateBlockRanks(blocks, factory.connections);

  // 2. Group blocks by rank
  const groups = groupBlocksByRank(blocks, ranks);

  // 3. Build incoming connection map
  const incomingMap = buildIncomingMap(factory.connections);

  // 4. Sort ranks to process left-to-right
  const sortedRanks = Array.from(groups.keys()).sort((a, b) => a - b);

  // 5. Position each column
  sortedRanks.forEach((rank) => {
    const group = groups.get(rank)!;
    positionColumn(group, rank, incomingMap, factory);
  });

  // 6. Update port sort orders
  blocks.forEach((b) => sortBlockPorts(b, factory));
}
