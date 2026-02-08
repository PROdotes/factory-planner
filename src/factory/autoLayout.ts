/**
 * ROLE: Layout Algorithm (V7 - Industrial Schematic)
 * PURPOSE: Logic for high-density mall construction. Group machines by common inputs.
 */

import { BlockBase } from "./core/BlockBase";
import { FactoryGraph } from "./core/FactoryGraph";
import { sortBlockPorts } from "./core/sortBlockPorts";
import { useGameDataStore } from "../gamedata/gamedataStore";
import { FLOW_CONFIG, getBlockHeight } from "../canvas/LayoutConfig";
import {
  collectInputItems,
  collectOutputItems,
} from "../canvas/blocks/blockIOCollector";
import { ProductionBlock } from "./blocks/ProductionBlock";
import { GathererBlock } from "./blocks/GathererBlock";

// Helper to calculate exact UI height of a block to prevent overlaps
function getPhysicalHeight(b: BlockBase): number {
  if (b.type === "logistics") return FLOW_CONFIG.JUNCTION_SIZE;

  const { recipes, items, gatherers } = useGameDataStore.getState();
  let recipe = null;
  let gatherer = null;

  if (b instanceof ProductionBlock && b.recipeId) recipe = recipes[b.recipeId];
  if (b instanceof GathererBlock && b.gathererId)
    gatherer = gatherers[b.gathererId];

  const inputs = collectInputItems(b, recipe, items, gatherer);
  const outputs = collectOutputItems(b, recipe, items, gatherer);

  return getBlockHeight(inputs.length, outputs.length);
}

// Layout constants - Balanced for Barycenter Sort
// Layout constants - Clustered & De-Clumped
const COL_WIDTH = 550;
const JUNCTION_MIN_DIST = 100; // Prevent junction label overlap
const START_X = 100;
const CENTER_Y = 500;

function isJunction(block: BlockBase): boolean {
  return block.type === "logistics";
}

// Collision detection: check if a belt at Y would pass through any buildings between ranks
// Geometric collision: check if a horizontal line from startX to endX at Y hits any block
export function checkGeometricCollision(
  y: number,
  startX: number,
  endX: number,
  allBlocks: BlockBase[],
  sourceId: string,
  targetId: string,
  margin: number = 30
): boolean {
  for (const block of allBlocks) {
    if (block.id === sourceId || block.id === targetId) continue;

    // Check X overlap (is the block between start and end?)
    // Block width is approx 190.
    // We only care if the BODY of the block is in the path.
    // Let's assume block occupies [x, x+200].
    const blockStart = block.position.x;
    const blockEnd = block.position.x + FLOW_CONFIG.BLOCK_WIDTH;

    // Strict betweenness?
    // If the path is Left -> Right (startX < endX)
    // We hit if (blockStart < endX) AND (blockEnd > startX)
    // AND it's not the source or target.
    // Narrow the window slightly to avoid touching neighbors.
    const pathMin = Math.min(startX, endX);
    const pathMax = Math.max(startX, endX);

    if (blockEnd > pathMin + 1 && blockStart < pathMax - 1) {
      // Check Y overlap
      const h = getPhysicalHeight(block);
      if (
        y >= block.position.y - margin &&
        y <= block.position.y + h + margin
      ) {
        return true;
      }
    }
  }
  return false;
}

// Find a safe Y corridor that doesn't intersect buildings
export function findSafeCorridorY(
  preferredY: number,
  startX: number,
  endX: number,
  allBlocks: BlockBase[],
  sourceId: string,
  targetId: string
): number {
  if (
    !checkGeometricCollision(
      preferredY,
      startX,
      endX,
      allBlocks,
      sourceId,
      targetId
    )
  ) {
    return preferredY;
  }
  // Search above and below in steps of PORT_VERTICAL_SPACING
  // Search above and below in steps of PORT_VERTICAL_SPACING
  // Expanded search range to +/- 1000 to solve deep overlaps
  for (
    let offset = FLOW_CONFIG.PORT_VERTICAL_SPACING;
    offset < 1000;
    offset += FLOW_CONFIG.PORT_VERTICAL_SPACING
  ) {
    if (
      !checkGeometricCollision(
        preferredY - offset,
        startX,
        endX,
        allBlocks,
        sourceId,
        targetId
      )
    ) {
      return preferredY - offset;
    }
    if (
      !checkGeometricCollision(
        preferredY + offset,
        startX,
        endX,
        allBlocks,
        sourceId,
        targetId
      )
    ) {
      return preferredY + offset;
    }
  }
  return preferredY; // Fallback: use preferred even if it collides
}

/**
 * ROLE: Logic Utility
 * PURPOSE: Identify distinct production chains (swimlanes) to organize the layout.
 */
export function identifySwimlanes(factory: FactoryGraph): Map<string, string> {
  const swimlanes = new Map<string, string>();
  const visited = new Set<string>();

  // 1. Find Roots (Blocks with no incoming connections)
  const incomingCounts = new Map<string, number>();
  factory.blocks.forEach((b) => incomingCounts.set(b.id, 0));

  factory.connections.forEach((c) => {
    incomingCounts.set(
      c.targetBlockId,
      (incomingCounts.get(c.targetBlockId) || 0) + 1
    );
  });

  const roots: string[] = [];
  factory.blocks.forEach((b) => {
    if ((incomingCounts.get(b.id) || 0) === 0) {
      roots.push(b.id);
    }
  });

  // Sort roots to ensure deterministic swimlane ordering
  roots.sort();

  // 2. Propagate Swimlane ID (BFS)
  const queue: string[] = [...roots];

  // Initialize roots with their own ID
  roots.forEach((r) => {
    swimlanes.set(r, r);
    visited.add(r);
  });

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentSwimlane = swimlanes.get(currentId)!;

    const children = factory.connections
      .filter((c) => c.sourceBlockId === currentId)
      .map((c) => c.targetBlockId);

    children.forEach((childId) => {
      if (!visited.has(childId)) {
        visited.add(childId);
        swimlanes.set(childId, currentSwimlane);
        queue.push(childId);
      }
    });
  }

  // 3. Handle Orphans (Cycles or floating blocks)
  factory.blocks.forEach((b) => {
    if (!visited.has(b.id)) {
      swimlanes.set(b.id, "misc");
    }
  });

  return swimlanes;
}

/**
 * Perform Layout focusing on "Supply Districts"
 */
export function performAutoLayout(factory: FactoryGraph) {
  const allBlocks = Array.from(factory.blocks.values());
  if (allBlocks.length === 0) return;

  // Clear transient layout metadata
  if (!factory.layoutMetadata) {
    factory.layoutMetadata = {
      beltYPositions: new Map(),
      blockBounds: new Map(),
      safeCorridors: new Map(),
    };
  }
  factory.layoutMetadata.beltYPositions.clear();

  const prodBlocks = allBlocks.filter((b) => !isJunction(b));

  // 1. Calculate Rank (X-Columns)
  const ranks = new Map<string, number>();
  prodBlocks.forEach((b) => ranks.set(b.id, 0));

  for (let i = 0; i < allBlocks.length; i++) {
    let changed = false;
    factory.connections.forEach((c) => {
      const rs = ranks.get(c.sourceBlockId) ?? 0;
      const rt = ranks.get(c.targetBlockId);
      if (rt !== undefined && rt <= rs) {
        ranks.set(c.targetBlockId, rs + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }

  // 2. INDUSTRIAL DISTRICTING (Swimlanes)
  const swimlaneMap = identifySwimlanes(factory);

  // Sort Swimlanes deterministically
  const uniqueSwimlanes = Array.from(new Set(swimlaneMap.values())).sort();
  const swimlaneOrder = new Map<string, number>();
  uniqueSwimlanes.forEach((id, index) => swimlaneOrder.set(id, index));

  // 3. Position Production Columns
  const columns = new Map<number, BlockBase[]>();
  prodBlocks.forEach((b) => {
    const r = ranks.get(b.id) ?? 0;
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r)!.push(b);
  });

  const sortedRanks = Array.from(columns.keys()).sort((a, b) => a - b);

  // 4. PRE-CALCULATE JUNCTION GROUPS (For Gap Sizing)
  const junctionsByTargetRank = new Map<number, BlockBase[]>();
  allBlocks.filter(isJunction).forEach((j) => {
    const outConns = factory.connections.filter(
      (c) => c.sourceBlockId === j.id
    );
    const targets = outConns
      .map((c) => factory.blocks.get(c.targetBlockId))
      .filter(Boolean) as BlockBase[];

    if (targets.length > 0) {
      const targetRank = ranks.get(targets[0].id) ?? 0;
      if (!junctionsByTargetRank.has(targetRank))
        junctionsByTargetRank.set(targetRank, []);
      junctionsByTargetRank.get(targetRank)!.push(j);
    }
  });

  // 3. Position Production Columns with CHANNEL-AWARE DYNAMIC WIDTH
  const calculateGap = (r: number) => {
    const uniqueItems = new Set<string>();

    factory.connections.forEach((c) => {
      const sourceRank = ranks.get(c.sourceBlockId);
      const targetRank = ranks.get(c.targetBlockId);

      if (sourceRank !== undefined && targetRank !== undefined) {
        if (sourceRank <= r && targetRank > r) {
          uniqueItems.add(c.itemId);
        }
      }
    });

    return COL_WIDTH + uniqueItems.size * FLOW_CONFIG.PORT_VERTICAL_SPACING;
  };

  // Calculate X positions iteratively
  const rankX = new Map<number, number>();
  let currentX = START_X;
  sortedRanks.forEach((r) => {
    rankX.set(r, currentX);
    const gap = calculateGap(r);
    currentX += gap;
  });

  // 3. MULTI-PASS RELAXATION (Unified Physics)
  const ITERATIONS = 10;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Phase 3B: Backward Pull (Children -> Parents)
    const backwardIdealY = new Map<string, number>();
    [...sortedRanks].reverse().forEach((r) => {
      const colBlocks = columns.get(r)!;
      colBlocks.forEach((b) => {
        const children = factory.connections
          .filter((c) => c.sourceBlockId === b.id)
          .map((c) => factory.blocks.get(c.targetBlockId))
          .filter((tgt) => tgt && (ranks.get(tgt.id) ?? 0) > r) as BlockBase[];

        if (children.length > 0) {
          const avg =
            children.reduce((sum, c) => sum + (c.position.y || CENTER_Y), 0) /
            children.length;
          backwardIdealY.set(b.id, avg);
          if (iter < ITERATIONS - 1) {
            b.position.y = avg;
          }
        }
      });
    });

    // Phase 3C: Unified Forward Layout (Parents -> Children + Constraints)
    sortedRanks.forEach((r) => {
      const colBlocks = columns.get(r)!;
      const x = rankX.get(r)!;

      const blockIdealY = new Map<string, number>();
      colBlocks.forEach((b) => {
        const parents = factory.connections
          .filter((c) => c.targetBlockId === b.id)
          .map((c) => factory.blocks.get(c.sourceBlockId))
          .filter((src) => src && (ranks.get(src.id) ?? 0) < r) as BlockBase[];

        let forwardY: number | null = null;
        if (parents.length > 0) {
          forwardY =
            parents.reduce((sum, s) => sum + s.position.y, 0) / parents.length;
        }

        const backwardY = backwardIdealY.get(b.id) ?? null;

        const ALPHA = 0.2;

        if (forwardY !== null && backwardY !== null) {
          blockIdealY.set(b.id, forwardY * (1 - ALPHA) + backwardY * ALPHA);
        } else if (forwardY !== null) {
          blockIdealY.set(b.id, forwardY);
        } else if (backwardY !== null) {
          blockIdealY.set(b.id, backwardY);
        } else {
          blockIdealY.set(b.id, CENTER_Y);
        }
      });

      // UNIFIED STACK (Machines + Belts)
      interface LayoutItem {
        type: "block" | "belt";
        id: string;
        name: string;
        idealY: number;
        height: number;
        ref?: BlockBase;
        swimlaneId: string;
        swimlaneOrder: number;
      }

      const items: LayoutItem[] = [];

      // Add Blocks with REAL PHYSICAL HEIGHT
      colBlocks.forEach((b) => {
        const h = getPhysicalHeight(b);
        const slId = swimlaneMap.get(b.id) || "misc";
        items.push({
          type: "block",
          id: b.id,
          name: b.name,
          idealY: blockIdealY.get(b.id)!,
          height: h + 20,
          ref: b,
          swimlaneId: slId,
          swimlaneOrder: swimlaneOrder.get(slId) ?? 999,
        });
      });

      // Add Pass-Through Belts (MANIFOLD GAPS)
      const passingItems = new Map<
        string,
        { itemId: string; totalY: number; count: number; swimlaneId: string }
      >();

      factory.connections.forEach((c) => {
        const sR = ranks.get(c.sourceBlockId) ?? 0;
        const tR = ranks.get(c.targetBlockId) ?? 0;
        if (sR < r && tR > r) {
          const src = factory.blocks.get(c.sourceBlockId);
          if (src) {
            const slId = swimlaneMap.get(src.id) || "misc";
            const groupKey = `${c.itemId}-${slId}`;
            const group = passingItems.get(groupKey) || {
              itemId: c.itemId,
              totalY: 0,
              count: 0,
              swimlaneId: slId,
            };
            group.totalY += src.position.y;
            group.count++;
            passingItems.set(groupKey, group);
          }
        }
      });

      passingItems.forEach((group, key) => {
        items.push({
          type: "belt",
          id: `belt-${r}-${key}`,
          name: "BELT",
          idealY: group.totalY / group.count,
          height: 20 + group.count * 20,
          swimlaneId: group.swimlaneId,
          swimlaneOrder: swimlaneOrder.get(group.swimlaneId) ?? 999,
        });
      });

      // Sort by Swimlane Order THEN Ideal Y
      items.sort((a, b) => {
        if (a.swimlaneOrder !== b.swimlaneOrder) {
          return a.swimlaneOrder - b.swimlaneOrder;
        }
        if (Math.abs(a.idealY - b.idealY) < 10) {
          if (a.type !== b.type) return a.type === "belt" ? -1 : 1;
          return a.name.localeCompare(b.name);
        }
        return a.idealY - b.idealY;
      });

      // Vertical Compaction (Center-Mass)
      let totalHeight = 0;
      const itemSpacing = new Map<any, number>();

      let _prev: LayoutItem | null = null;
      items.forEach((item) => {
        let spacing = 0;
        if (_prev) {
          if (item.swimlaneId !== _prev.swimlaneId) {
            spacing = 80;
          } else if (item.type === "block" && _prev.type === "block") {
            spacing = item.name !== _prev.name ? 80 : 10;
          } else {
            spacing = 20;
          }
        }
        itemSpacing.set(item, spacing);
        totalHeight += spacing + item.height;
        _prev = item;
      });

      const avgIdealY =
        items.length > 0
          ? items.reduce((sum, i) => sum + i.idealY, 0) / items.length
          : CENTER_Y;

      let currentY = avgIdealY - totalHeight / 2;

      // Place Items
      items.forEach((item) => {
        const spacing = itemSpacing.get(item) ?? 0;
        const minStackY = currentY + spacing;

        let placedY = Math.max(minStackY, item.idealY);

        if (item.type === "block" && item.ref) {
          item.ref.position.y = placedY;
          item.ref.position.x = x;
        }

        if (item.type === "belt") {
          factory.layoutMetadata.beltYPositions.set(item.id, {
            y: placedY,
            h: item.height,
          });
        }

        currentY = placedY + item.height;
      });
    });
  }

  // 4. CHANNEL-BASED JUNCTION POSITIONING
  const positionedJunctions: BlockBase[] = [];

  junctionsByTargetRank.forEach((junctions, targetRank) => {
    junctions.sort((a, b) => {
      const getSourceY = (j: BlockBase) => {
        const inC = factory.connections.find((c) => c.targetBlockId === j.id);
        if (inC) {
          const src = factory.blocks.get(inC.sourceBlockId);
          if (src) return src.position.y;
        }
        return 0;
      };
      return getSourceY(a) - getSourceY(b);
    });

    const targetX = rankX.get(targetRank) ?? 0;
    const sourceRank = targetRank - 1;
    const sourceX = rankX.get(sourceRank) ?? targetX - 500;
    const gapStartX = sourceX + COL_WIDTH;
    const gapCenterX = (gapStartX + targetX) / 2;

    junctions.forEach((j, i) => {
      const totalChannelWidth = junctions.length * 45;
      const groupStartX = gapCenterX - totalChannelWidth / 2;

      j.position.x = groupStartX + i * 45;

      const outC = factory.connections.find((c) => c.sourceBlockId === j.id);
      const target = outC ? factory.blocks.get(outC.targetBlockId) : null;

      if (target) {
        j.position.y = target.position.y;
      } else {
        j.position.y = CENTER_Y;
      }
      positionedJunctions.push(j);
    });
  });

  // 4B. Resolve Junction Overlaps
  positionedJunctions.sort((a, b) => a.position.y - b.position.y);

  for (let i = 1; i < positionedJunctions.length; i++) {
    const prev = positionedJunctions[i - 1];
    const curr = positionedJunctions[i];

    if (curr.position.y < prev.position.y + JUNCTION_MIN_DIST) {
      curr.position.y = prev.position.y + JUNCTION_MIN_DIST;
    }
  }

  // 4C. Re-Center Junction Clusters
  const junctionsByTargetId = new Map<string, BlockBase[]>();
  positionedJunctions.forEach((j) => {
    const outC = factory.connections.find((c) => c.sourceBlockId === j.id);
    if (outC) {
      if (!junctionsByTargetId.has(outC.targetBlockId))
        junctionsByTargetId.set(outC.targetBlockId, []);
      junctionsByTargetId.get(outC.targetBlockId)!.push(j);
    }
  });

  junctionsByTargetId.forEach((junctions, targetId) => {
    const target = factory.blocks.get(targetId);
    if (!target) return;

    const clusterMinY = Math.min(...junctions.map((j) => j.position.y));
    const clusterMaxY = Math.max(...junctions.map((j) => j.position.y));
    const clusterCenter = (clusterMinY + clusterMaxY) / 2;

    const targetCenter = target.position.y;
    const shift = targetCenter - clusterCenter;

    junctions.forEach((j) => (j.position.y += shift));
  });

  // 5. COLUMN TOP-ALIGNMENT
  sortedRanks.forEach((r) => {
    const colBlocks = allBlocks.filter(
      (b) => ranks.get(b.id) === r && !isJunction(b)
    );
    const colJunctions = junctionsByTargetRank.get(r) ?? [];

    const relevantBlocks = [...colBlocks, ...colJunctions];

    if (relevantBlocks.length > 0) {
      let minY = Infinity;
      relevantBlocks.forEach((b) => {
        if (b.position.y < minY) minY = b.position.y;
      });

      const TARGET_TOP = 100;
      const shift = TARGET_TOP - minY;

      if (isFinite(shift)) {
        relevantBlocks.forEach((b) => (b.position.y += shift));

        // Shift belts in this column too
        let movedBelts = 0;
        factory.layoutMetadata.beltYPositions.forEach((pos, key) => {
          if (key.startsWith(`belt-${r}-`)) {
            pos.y += shift;
            movedBelts++;
          }
        });
        // console.log(`[AutoLayout] Col ${r} Top-Align: Shifted ${shift}px. moved ${movedBelts} belts.`);
      }
    }
  });

  // 6. Build blockBounds for collision detection
  factory.layoutMetadata.blockBounds = new Map();
  sortedRanks.forEach((r) => {
    const colBlocks = columns.get(r) || [];
    factory.layoutMetadata.blockBounds.set(
      r,
      colBlocks.map((b) => ({
        blockId: b.id,
        y: b.position.y,
        height: getPhysicalHeight(b),
      }))
    );
  });

  // 8. Port Sort (Run before collision check to ensure accurate start Y)
  allBlocks.forEach((b) => sortBlockPorts(b, factory));

  // 7. Compute safe corridors for connections that would pass through buildings
  factory.layoutMetadata.safeCorridors = new Map();
  factory.connections.forEach((conn) => {
    const source = factory.blocks.get(conn.sourceBlockId);
    const target = factory.blocks.get(conn.targetBlockId);
    if (!source || !target) return;

    const sourceRank = ranks.get(conn.sourceBlockId);
    const targetRank = ranks.get(conn.targetBlockId);
    if (sourceRank === undefined || targetRank === undefined) return;
    if (targetRank <= sourceRank) return; // Skip backwards connections

    // Calculate preferred Y based on source port position
    const pIdx = (source.outputOrder || []).indexOf(conn.itemId);
    const portHStart =
      FLOW_CONFIG.HEADER_HEIGHT +
      FLOW_CONFIG.BORDER_WIDTH +
      FLOW_CONFIG.CONTROLS_HEIGHT;
    const portY =
      source.type === "logistics"
        ? FLOW_CONFIG.JUNCTION_SIZE / 2
        : pIdx >= 0
        ? portHStart +
          pIdx * FLOW_CONFIG.PORT_VERTICAL_SPACING +
          FLOW_CONFIG.PORT_VERTICAL_SPACING / 2
        : portHStart;

    const sourceAbsY = source.position.y + portY;

    // Check beltYPositions first for manifold alignment
    const slId = swimlaneMap.get(source.id) || "misc";
    const groupKey = `${conn.itemId}-${slId}`;
    const beltKey = `belt-${sourceRank + 1}-${groupKey}`;
    const physical = factory.layoutMetadata.beltYPositions.get(beltKey);
    const preferredY = physical ? physical.y + physical.h / 2 : sourceAbsY;

    // Use actual physical coordinates for collision check
    const startX = source.position.x;
    const endX = target.position.x;

    const safeY = findSafeCorridorY(
      preferredY,
      startX,
      endX,
      allBlocks,
      source.id,
      target.id
    );

    // Always store if the path deviates from the direct port line
    // This ensures ConnectionLines (which may not know about belt lanes) finds the correct path
    if (Math.abs(safeY - sourceAbsY) > 1) {
      factory.layoutMetadata.safeCorridors.set(conn.id, safeY);
    }
  });
}
