/**
 * ROLE: Utility Functions
 * PURPOSE: SVG path geometry calculations for connection rendering.
 * RELATION: Used by ConnectionPath and ConnectionLines components.
 */

import { FLOW_CONFIG } from "../LayoutConfig";

/**
 * Generates an ortho-stepped path string between two points.
 * Includes a deterministic 'stagger' to prevent overlapping lines in a bus.
 */
export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed?: string
): string {
  const dx = x2 - x1;

  // Calculate a deterministic offset based on the ID (seed)
  let stagger = 0;
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    stagger = (Math.abs(hash) % 5) * 8; // 0, 8, 16, 24, 32px offsets
  }

  const leadOut = 40 + stagger;

  if (dx < leadOut + 20) {
    const mid = x1 + dx / 2;
    return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
  }

  return `M ${x1} ${y1} L ${x1 + leadOut} ${y1} L ${
    x1 + leadOut
  } ${y2} L ${x2} ${y2}`;
}

/**
 * Calculates the midpoint between two points, offset upward for label placement.
 */
export function midpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 15 };
}

/**
 * Calculates the absolute position of a port given block position and port Y offset.
 * @param blockX - Block's X position
 * @param blockY - Block's Y position
 * @param side - Which side of the block ("left" for inputs, "right" for outputs)
 * @param portY - Vertical offset of the port within the block
 * @param type - Block type (affects width calculation for logistics blocks)
 */
export function portXY(
  blockX: number,
  blockY: number,
  side: "left" | "right",
  portY: number,
  type?: string
): { x: number; y: number } {
  const width =
    type === "logistics" ? FLOW_CONFIG.JUNCTION_SIZE : FLOW_CONFIG.BLOCK_WIDTH;
  return {
    x: side === "left" ? blockX : blockX + width,
    y: blockY + portY,
  };
}
