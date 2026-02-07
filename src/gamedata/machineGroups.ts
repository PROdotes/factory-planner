/**
 * ROLE: Game Data Utility
 * PURPOSE: Defines the upgrade paths for machines (e.g., Assembler Mk1 -> Mk2 -> Mk3).
 * RELATION: Used by BlockControls to allow cycling through machine tiers.
 */

export const MACHINE_GROUPS: Record<string, string[]> = {
  // Assemblers
  "assembling-machine-mk-i": [
    "assembling-machine-mk-i",
    "assembling-machine-mk-ii",
    "assembling-machine-mk-iii",
  ],
  "assembling-machine-mk-ii": [
    "assembling-machine-mk-i",
    "assembling-machine-mk-ii",
    "assembling-machine-mk-iii",
  ],
  "assembling-machine-mk-iii": [
    "assembling-machine-mk-i",
    "assembling-machine-mk-ii",
    "assembling-machine-mk-iii",
  ],

  // Smelters
  "arc-smelter": ["arc-smelter", "plane-smelter"],
  "plane-smelter": ["arc-smelter", "plane-smelter"],

  // Miners
  "mining-machine": ["mining-machine", "advanced-mining-machine"],
  "advanced-mining-machine": ["mining-machine", "advanced-mining-machine"],

  // Chemical Plants (Quantum might not be in all versions of the data, but good to have)
  "chemical-plant": ["chemical-plant", "quantum-chemical-plant"],
  "quantum-chemical-plant": ["chemical-plant", "quantum-chemical-plant"],
};

/**
 * Returns the next machine in the tier list, or loops back to the start.
 * If the machine is not in a group, returns the same machineId.
 */
export function getNextMachineTier(currentMachineId: string): string {
  const group = MACHINE_GROUPS[currentMachineId];
  if (!group) return currentMachineId;

  const index = group.indexOf(currentMachineId);
  if (index === -1) return currentMachineId;

  const nextIndex = (index + 1) % group.length;
  return group[nextIndex];
}

/**
 * Checks if a machine has available upgrades/downgrades.
 */
export function hasMachineTiers(machineId: string): boolean {
  return !!MACHINE_GROUPS[machineId] && MACHINE_GROUPS[machineId].length > 1;
}
