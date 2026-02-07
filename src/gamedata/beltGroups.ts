/**
 * ROLE: Game Data Utility
 * PURPOSE: Defines the upgrade paths for belts (Mk1 -> Mk2 -> Mk3).
 * RELATION: Used by ConnectionLines to allow cycling through belt tiers.
 */

export const BELT_GROUPS: Record<string, string[]> = {
  // Conveyor Belts
  "conveyor-belt-mk-i": [
    "conveyor-belt-mk-i",
    "conveyor-belt-mk-ii",
    "conveyor-belt-mk-iii",
  ],
  "conveyor-belt-mk-ii": [
    "conveyor-belt-mk-i",
    "conveyor-belt-mk-ii",
    "conveyor-belt-mk-iii",
  ],
  "conveyor-belt-mk-iii": [
    "conveyor-belt-mk-i",
    "conveyor-belt-mk-ii",
    "conveyor-belt-mk-iii",
  ],
};

export const BELT_SPEEDS: Record<string, number> = {
  "conveyor-belt-mk-i": 6, // 6 items/s
  "conveyor-belt-mk-ii": 12, // 12 items/s
  "conveyor-belt-mk-iii": 30, // 30 items/s
};

/**
 * Returns the next belt in the tier list, or loops back to the start.
 * If the belt is not in a group, returns the same beltId.
 */
export function getNextBeltTier(currentBeltId: string | undefined): string {
  // Default to Mk.1 if undefined
  const effectiveId = currentBeltId || "conveyor-belt-mk-i";
  const group = BELT_GROUPS[effectiveId];
  if (!group) return "conveyor-belt-mk-i";

  const index = group.indexOf(effectiveId);
  if (index === -1) return "conveyor-belt-mk-i";

  const nextIndex = (index + 1) % group.length;
  return group[nextIndex];
}

/**
 * Checks if a belt has available upgrades/downgrades.
 */
export function hasBeltTiers(beltId: string | undefined): boolean {
  const effectiveId = beltId || "conveyor-belt-mk-i";
  return !!BELT_GROUPS[effectiveId] && BELT_GROUPS[effectiveId].length > 1;
}
