/**
 * ROLE: Utility Functions
 * PURPOSE: SVG path geometry calculations for connection rendering.
 * RELATION: Used by ConnectionPath and ConnectionLines components.
 */

import { FLOW_CONFIG } from "../LayoutConfig";

/**
 * Generates a cubic bezier curve SVG path string between two points.
 * The control points create a smooth horizontal-biased curve.
 */
export function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  return `M ${x1} ${y1} C ${x1 + dx * 0.4} ${y1}, ${
    x2 - dx * 0.4
  } ${y2}, ${x2} ${y2}`;
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
