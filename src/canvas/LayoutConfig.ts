/**
 * ROLE: Layout Configuration
 * PURPOSE: Single source of truth for canvas dimensions and offsets.
 * RELATION: Used by components (BlockCard, ConnectionLines) to avoid magic numbers.
 */

export const FLOW_CONFIG = {
  // --- UI Metrics ---
  SIDEBAR_WIDTH: 350,
  SIDEBAR_TRANSITION_MS: 200,

  // --- Block Dimensions ---
  BLOCK_WIDTH: 220, // Wide enough for controls row
  HEADER_HEIGHT: 28,
  CONTROLS_HEIGHT: 42,
  FOOTER_HEIGHT: 26,
  BORDER_WIDTH: 1,

  // --- Port Geometry ---
  PORT_VERTICAL_SPACING: 60, // Matches io-row height
  PORT_RADIUS: 25,

  // --- Junction Metrics ---
  JUNCTION_SIZE: 48,
} as const;

export function getBlockHeight(numInputs: number, numOutputs: number): number {
  const totalRows = numInputs + numOutputs;
  const contentHeight = totalRows * FLOW_CONFIG.PORT_VERTICAL_SPACING;
  // Account for: Header Border + Output Group Border + Footer Border
  const totalBorders = 3;
  return (
    FLOW_CONFIG.HEADER_HEIGHT +
    FLOW_CONFIG.CONTROLS_HEIGHT +
    contentHeight +
    FLOW_CONFIG.FOOTER_HEIGHT +
    totalBorders * FLOW_CONFIG.BORDER_WIDTH
  );
}
