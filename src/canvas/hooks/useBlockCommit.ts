/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Provides commit handlers for block value changes.
 * RELATION: Used by BlockCard and BlockControls for user input.
 */

import { useCallback } from "react";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { GathererBlock } from "../../factory/blocks/GathererBlock";
import { useFactoryStore } from "../../factory/factoryStore";
import { Recipe, Machine, Gatherer } from "../../gamedata/gamedata.types";

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
  block: ProductionBlock | GathererBlock,
  recipe: Recipe | null,
  machine: Machine | null,
  isPerMin: boolean,
  gatherer?: Gatherer | null
): BlockCommitHandlers {
  const { setRequest, setYield, setMachineCount } = useFactoryStore();
  const mainOutputId = recipe?.outputs[0]?.itemId ?? gatherer?.outputItemId;
  const isGenerator = !recipe && !gatherer && !!machine?.generation;
  const isGatherer = block instanceof GathererBlock;

  const commitMachineCount = useCallback(
    (val: number) => {
      if (isNaN(val) || val < 0) return;

      if (!isGatherer && recipe && recipe.outputs[0] && machine) {
        const ratePerMachine =
          (recipe.outputs[0].amount * machine.speed) / recipe.craftingTime;
        setRequest(block.id, recipe.outputs[0].itemId, val * ratePerMachine);
      }

      // For both gatherers and standard machines, we track machineCount normally
      setMachineCount(block.id, val);
    },
    [block.id, recipe, machine, isGatherer, setRequest, setMachineCount]
  );

  const commitOutputRate = useCallback(
    (val: number) => {
      if (isGenerator) return; // Cannot edit rate directly for generators
      if (isNaN(val) || val < 0 || !mainOutputId) return;

      const perSec = isPerMin ? val / 60 : val;

      if (isGatherer && machine && gatherer) {
        // Gathering Law: Rate = ExtractionRate * Speed * Yield
        // Yield = Rate / (ExtractionRate * Speed)
        const ratePerVein = gatherer.extractionRate * machine.speed;
        if (ratePerVein > 0) {
          setYield(block.id, perSec / ratePerVein);
        }
        setRequest(block.id, gatherer.outputItemId, perSec);
      } else if (recipe && machine && recipe.outputs[0]) {
        // Standard Machine Law: Target Rate = MachineCount * RatePerMachine
        const ratePerMachine =
          (recipe.outputs[0].amount * machine.speed) / recipe.craftingTime;
        if (ratePerMachine > 0) {
          setMachineCount(block.id, perSec / ratePerMachine);
          setRequest(block.id, recipe.outputs[0].itemId, perSec);
        }
      }
    },
    [
      block.id,
      recipe,
      gatherer,
      mainOutputId,
      machine,
      isPerMin,
      isGenerator,
      isGatherer,
      setRequest,
      setYield,
      setMachineCount,
    ]
  );

  const commitYield = useCallback(
    (val: number) => {
      if (isNaN(val) || val < 0) return;

      setYield(block.id, val);
      if (isGatherer && machine && gatherer) {
        const ratePerVein = gatherer.extractionRate * machine.speed;
        setRequest(block.id, gatherer.outputItemId, val * ratePerVein);
      }
    },
    [block.id, machine, gatherer, isGatherer, setYield, setRequest]
  );

  return { commitMachineCount, commitOutputRate, commitYield };
}
