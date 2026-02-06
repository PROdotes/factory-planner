/**
 * ROLE: Utility Functions
 * PURPOSE: Shared formatting and status helpers for block rendering.
 * RELATION: Used by BlockCard, BlockFooter, BlockIORows.
 */

export function formatRate(
  ratePerSecond: number,
  isPerMinute: boolean
): string {
  const val = isPerMinute ? ratePerSecond * 60 : ratePerSecond;
  if (val >= 100) return `${Math.round(val)}`;
  if (val >= 10) return `${val.toFixed(1)}`;
  if (val >= 1) return `${val.toFixed(1)}`;
  return `${val.toFixed(2)}`;
}

export function getStatusClass(satisfaction: number): string {
  if (satisfaction >= 0.999) return "status-ok";
  if (satisfaction > 0.001) return "status-warn";
  return "status-error";
}

export function getBarColor(satisfaction: number): string {
  if (satisfaction >= 0.999) return "var(--flow-success)";
  if (satisfaction > 0.001) return "var(--flow-warning)";
  return "var(--flow-error)";
}
