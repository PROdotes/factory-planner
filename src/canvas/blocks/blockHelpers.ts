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

/**
 * Logic: A block is 'Failing' (Red) only if it is the ROOT CAUSE of a throughput issue.
 * 1. Success: Meeting the global factory goal -> BLUE
 * 2. Idling: Below goal, but has inputs and spare capacity -> BLUE (Bystander)
 * 3. Failing: Below goal AND (At Capacity OR Starved) -> RED (Culprit/Victim)
 */
export function isBlockFailing(
  inputSatisfaction: number,
  outputActual: number,
  outputGoal: number,
  outputCapacity: number,
  isLogistics: boolean = false,
  isGathering: boolean = false
): boolean {
  // Logistics blocks (Splitters/Mergers) are 'Failing' if they are starved.
  if (isLogistics) {
    return inputSatisfaction < 0.99;
  }

  // GATHERING Logic: Strict Capacity vs Goal
  // Ideally, if a miner is configured to meet demand (Capacity >= Goal), it is "OK" (Blue).
  // If it is under-configured (Capacity < Goal), it is "Failing" (Amber via CSS).
  // We ignore 'Actual' for miners because 99% throughput shouldn't flag a configured miner as failing.
  if (isGathering) {
    return outputCapacity < outputGoal - 0.001;
  }

  // 1. Are we meeting the factory plan? If yes, we are Blue.
  if (outputActual >= outputGoal - 0.001) return false;

  // 2. We are below plan. Are we the reason?
  const atPhysicalLimit =
    outputActual >= outputCapacity * 0.99 && outputCapacity > 0;
  const isMissingInputs = inputSatisfaction < 0.99;

  // If we are at our limit or starved, we are Red.
  return atPhysicalLimit || isMissingInputs;
}
