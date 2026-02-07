/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Provides commit handlers for block value changes.
 * RELATION: Used by BlockCard and BlockControls for user input.
 */

import { useCallback } from "react";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { useFactoryStore } from "../../factory/factoryStore";
import { Recipe, Machine } from "../../gamedata/gamedata.types";

interface BlockCommitHandlers {
  commitMachineCount: (val: number) => void;
  commitOutputRate: (val: number) => void;
  commitYield: (val: number) => void;
}

/**
 * Hook that provides commit handlers for block value changes.
 * Handles the complex logic of syncing machine count, output rate, and yield.
 */
export function useBlockCommit(
  block: ProductionBlock,
  recipe: Recipe | null,
  machine: Machine | null,
  isPerMin: boolean
): BlockCommitHandlers {
  const { setRequest, setYield, setMachineCount } = useFactoryStore();
  const mainOutput = recipe?.outputs[0];
  const isGenerator = !recipe && !!machine?.generation;

  const commitMachineCount = useCallback(
    (val: number) => {
      if (isNaN(val) || val < 0) return;

      if (recipe && mainOutput && machine) {
        const isGatherer = recipe.category === "Gathering";
        if (isGatherer) {
          // Miners (Gathering): Machine count does not drive rate, Veins do.
          // Don't update setRequest here.
        } else {
          const ratePerMachine =
            (mainOutput.amount * machine.speed) / recipe.craftingTime;
          setRequest(block.id, mainOutput.itemId, val * ratePerMachine);
        }
      }
      // For generators, we just set the machine count directly
      setMachineCount(block.id, val);
    },
    [
      block.id,
      block.sourceYield,
      recipe,
      mainOutput,
      machine,
      setRequest,
      setMachineCount,
    ]
  );

  const commitOutputRate = useCallback(
    (val: number) => {
      if (isGenerator) return; // Cannot edit rate directly for generators
      if (isNaN(val) || val < 0 || !mainOutput) return;

      const perSec = isPerMin ? val / 60 : val;

      const isGatherer = recipe?.category === "Gathering";

      if (isGatherer && machine) {
        // Gathering Law: Target Rate = Veins * RatePerVein
        // Veins = Target Rate / RatePerVein
        const ratePerVein =
          (mainOutput.amount * machine.speed) / recipe.craftingTime;
        if (ratePerVein > 0) {
          setYield(block.id, perSec / ratePerVein);
        }
        setRequest(block.id, mainOutput.itemId, perSec);
      } else if (recipe && machine) {
        // Standard Machine Law: Target Rate = MachineCount * RatePerMachine
        const ratePerMachine =
          (mainOutput.amount * machine.speed) / recipe.craftingTime;
        if (ratePerMachine > 0) {
          setMachineCount(block.id, perSec / ratePerMachine);
          setRequest(block.id, mainOutput.itemId, perSec);
        }
      }
    },
    [
      block.id,
      block.sourceYield,
      recipe,
      mainOutput,
      machine,
      isPerMin,
      isGenerator,
      setRequest,
      setYield,
      setMachineCount,
    ]
  );

  const commitYield = useCallback(
    (val: number) => {
      if (isNaN(val) || val < 0) return;

      setYield(block.id, val);
      const isGatherer = recipe?.category === "Gathering";
      if (isGatherer && mainOutput && machine) {
        const ratePerVein =
          (mainOutput.amount * machine.speed) / recipe.craftingTime;
        setRequest(block.id, mainOutput.itemId, val * ratePerVein);
      }
    },
    [block.id, recipe, mainOutput, machine, setYield, setRequest]
  );

  return { commitMachineCount, commitOutputRate, commitYield };
}
