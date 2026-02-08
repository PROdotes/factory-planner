/**
 * ROLE: Layout Algorithm (V7 - Industrial Schematic)
 * PURPOSE: Logic for high-density mall construction. Group machines by common inputs.
 */

import { BlockBase } from "./core/BlockBase";
import { FactoryGraph } from "./core/FactoryGraph";
import { sortBlockPorts } from "./core/sortBlockPorts";

// Layout constants - VASTLY increased for mall clarity
const COL_WIDTH = 650;
const NODE_ROW_HEIGHT = 450;
const START_X = 100;
const CENTER_Y = 500;

function isJunction(block: BlockBase): boolean {
  return block.type === "logistics";
}

/**
 * Perform Layout focusing on "Supply Districts"
 */
export function performAutoLayout(factory: FactoryGraph) {
  const allBlocks = Array.from(factory.blocks.values());
  if (allBlocks.length === 0) return;

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

  // 2. INDUSTRIAL DISTRICTING (Y-Alignment)
  // We group machines by their PRIMARY input source to create "Vertical Districts"
  const districts = new Map<string, string[]>(); // sourceId -> targetIds
  factory.connections.forEach((c) => {
    if (ranks.has(c.sourceBlockId) && ranks.has(c.targetBlockId)) {
      if (!districts.has(c.sourceBlockId)) districts.set(c.sourceBlockId, []);
      if (!districts.get(c.sourceBlockId)!.includes(c.targetBlockId)) {
        districts.get(c.sourceBlockId)!.push(c.targetBlockId);
      }
    }
  });

  // 3. Position Production Columns
  const columns = new Map<number, BlockBase[]>();
  prodBlocks.forEach((b) => {
    const r = ranks.get(b.id) ?? 0;
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r)!.push(b);
  });

  const sortedRanks = Array.from(columns.keys()).sort((a, b) => a - b);

  sortedRanks.forEach((r) => {
    const colBlocks = columns.get(r)!;
    // Sort within column: Put machines with shared sources next to each other
    colBlocks.sort((a, b) => {
      const sourceA =
        factory.connections.find((c) => c.targetBlockId === a.id)
          ?.sourceBlockId || "";
      const sourceB =
        factory.connections.find((c) => c.targetBlockId === b.id)
          ?.sourceBlockId || "";
      return sourceA.localeCompare(sourceB);
    });

    const x = START_X + r * COL_WIDTH;
    const totalH = (colBlocks.length - 1) * NODE_ROW_HEIGHT;
    let startY = CENTER_Y - totalH / 2;

    colBlocks.forEach((b) => {
      b.position.x = x;
      b.position.y = startY;
      startY += NODE_ROW_HEIGHT;
    });
  });

  // 4. SERIAL JUNCTION POSITIONING
  // Instead of midpoints, we align junctions along a vertical "Serial Bus"
  // right before their machine column.
  allBlocks.filter(isJunction).forEach((j) => {
    const outConns = factory.connections.filter(
      (c) => c.sourceBlockId === j.id
    );
    const inConns = factory.connections.filter((c) => c.targetBlockId === j.id);

    const targets = outConns
      .map((c) => factory.blocks.get(c.targetBlockId))
      .filter(Boolean) as BlockBase[];
    const sources = inConns
      .map((c) => factory.blocks.get(c.sourceBlockId))
      .filter(Boolean) as BlockBase[];

    if (targets.length > 0) {
      // Position j at a fixed offset to the left of its targets' average column
      const avgX =
        targets.reduce((sum, t) => sum + t.position.x, 0) / targets.length;
      const avgY =
        targets.reduce((sum, t) => sum + t.position.y, 0) / targets.length;
      j.position.x = avgX - 180; // 180px gap for the "bus backbone"
      j.position.y = avgY;
    } else if (sources.length > 0) {
      const avgX =
        sources.reduce((sum, src) => sum + src.position.x, 0) / sources.length;
      const avgY =
        sources.reduce((sum, src) => sum + src.position.y, 0) / sources.length;
      j.position.x = avgX + 180;
      j.position.y = avgY;
    }
  });

  // 5. Port Sort
  allBlocks.forEach((b) => sortBlockPorts(b, factory));
}
