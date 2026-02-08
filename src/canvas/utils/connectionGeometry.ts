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
/**
 * Generates an ortho-stepped path string between two points.
 * Creates a "Bus" style layout where lines travel horizontally, then share a vertical channel.
 */
export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number = 0,
  sourceOffset: number = 0,
  exitOffset: number = 0
): string {
  const dx = x2 - x1;

  // 1. Determine "Safe Y" for the horizontal crossing
  // We move the belt vertically by sourceOffset after a horizontal stub
  const exitX = x1 + FLOW_CONFIG.PORT_VERTICAL_SPACING + exitOffset;
  const safeY = y1 + sourceOffset;

  // 2. Target-Anchored Bus Pillar
  const busX = x2 - FLOW_CONFIG.PORT_VERTICAL_SPACING * 1.5 + offset;

  // Handling "Backwards" connections (loops)
  if (dx < 0) {
    const loopBackX = x1 + FLOW_CONFIG.PORT_VERTICAL_SPACING + offset;
    const loopEntryX = x2 - FLOW_CONFIG.PORT_VERTICAL_SPACING - offset;
    return `M ${x1} ${y1} L ${loopBackX} ${y1} L ${loopBackX} ${
      y1 + 100
    } L ${loopEntryX} ${y1 + 100} L ${loopEntryX} ${y2} L ${x2} ${y2}`;
  }

  // 3. Double-Manhattan Path:
  // Exit -> Vertical to Safe Lane -> Horizontal to Bus -> Vertical to Target -> Entry
  return `M ${x1} ${y1} L ${exitX} ${y1} L ${exitX} ${safeY} L ${busX} ${safeY} L ${busX} ${y2} L ${x2} ${y2}`;
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
