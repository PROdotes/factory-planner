/**
 * ROLE: Utility Functions
 * PURPOSE: Determines connection visual state (color, labels) based on flow status.
 * RELATION: Used by ConnectionPathWithPorts for rendering decisions.
 */

import { BlockBase } from "../../factory/core/BlockBase";
import { Recipe, Gatherer } from "../../gamedata/gamedata.types";
import { isBlockFailing } from "./blockHelpers";
import { BELT_SPEEDS } from "../../gamedata/beltGroups";

interface Connection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  itemId: string;
  beltId?: string;
  rate: number;
  demand: number;
}

// ItemMap is now implicitly used in formatters
export interface ItemMap {
  [id: string]: { name: string } | undefined;
}

interface RecipeMap {
  [id: string]: Recipe | undefined;
}

interface GathererMap {
  [id: string]: Gatherer | undefined;
}

/**
 * Checks if a block is failing based on its primary output flow.
 * Used to determine the "chain of blame" for connection coloring.
 */
export function checkBlockFailing(
  block: BlockBase,
  recipes: RecipeMap,
  gatherers?: GathererMap
): boolean {
  const recipe = (block as any).recipeId
    ? recipes[(block as any).recipeId]
    : null;
  const isGatherer = block.type === "gatherer";

  let mainItemId: string | undefined;
  if (isGatherer) {
    const gathererId = (block as any).gathererId;
    mainItemId =
      gathererId && gatherers ? gatherers[gathererId]?.outputItemId : undefined;
  } else {
    mainItemId = recipe?.outputs[0]?.itemId;
  }

  const primaryFlow = mainItemId ? block.results?.flows?.[mainItemId] : null;

  return isBlockFailing(
    block.satisfaction,
    primaryFlow?.sent ?? 0,
    primaryFlow?.demand ?? 0,
    primaryFlow?.capacity ?? 0,
    block.type === "logistics",
    isGatherer
  );
}

export interface ConnectionStatus {
  isStarved: boolean; // Red - chain of pain propagation
  isShortfall: boolean; // Orange - culprit transition point
}

/**
 * Determines the visual status of a connection based on the "Chain of Blame" model.
 *
 * Rules:
 * - (Blue) -> (Red) = Orange (The Culprit starts here)
 * - (Red) -> (Red) = Red (The Chain of Pain)
 * - (X) -> (Blue) = Blue (Healthy)
 *
 * If the connection is fulfilling 100% of planned demand, it's always Blue.
 */
export function getConnectionStatus(
  source: BlockBase,
  target: BlockBase,
  conn: Connection,
  recipes: RecipeMap,
  gatherers?: GathererMap
): ConnectionStatus {
  const sourceIsFailing = checkBlockFailing(source, recipes, gatherers);
  const targetIsFailing = checkBlockFailing(target, recipes, gatherers);

  let isStarved = false;
  let isShortfall = false;

  if (targetIsFailing) {
    if (sourceIsFailing) {
      isStarved = true; // Propagation (R -> R)
    } else {
      isShortfall = true; // Transition (B -> R)
    }
  } else if (sourceIsFailing) {
    isStarved = true; // Red if feeding a blue machine too little (Source Limit)
  }

  // 100% Fulfillment OVERRIDE: If this belt is 100% as planned, always Blue/Cyan
  const planRequired = conn.demand;
  if (conn.rate >= planRequired - 0.001) {
    isStarved = false;
    isShortfall = false;
  }

  return { isStarved, isShortfall };
}

export interface ConnectionLabelData {
  beltCount: number;
  beltTier: string;
  rateText: string;
}

/**
 * Returns structured data for the connection label:
 * - beltCount: Ceiled number of belts needed (e.g. 2)
 * - beltTier: "MK.1", "MK.2", "MK.3"
 * - rateText: "360/m" or "360 / 720/m"
 */
export function getConnectionLabelData(
  conn: Connection,
  isPerMin: boolean,
  planRequired: number,
  machineRequired: number
): ConnectionLabelData {
  const rateMult = isPerMin ? 60 : 1;
  const rateLabel = isPerMin ? "/m" : "/s";

  const actualStr = (conn.rate * rateMult).toFixed(1);
  const planStr = (planRequired * rateMult).toFixed(1);

  // 1. Resolve Belt Tier Label
  const beltTier = conn.beltId
    ? conn.beltId.includes("iii")
      ? "MK.3"
      : conn.beltId.includes("ii")
      ? "MK.2"
      : "MK.1"
    : "MK.1";

  // 2. Resolve Belt Count
  const selectedBeltId = conn.beltId || "conveyor-belt-mk-i";
  const beltSpeed = BELT_SPEEDS[selectedBeltId] || 6;
  const targetFlow = Math.max(conn.rate, planRequired, machineRequired);

  // Ceil logic: 0.1 -> 1 belt
  const beltsRequiredRaw = targetFlow / beltSpeed;
  const beltsRequiredSeq = Math.ceil(beltsRequiredRaw - 0.0001);
  const beltCount = Math.max(1, beltsRequiredSeq);

  // 3. Rate Text
  let rateText = `${actualStr}${rateLabel}`;
  if (planRequired > machineRequired + 0.001) {
    rateText = `${actualStr} / ${planStr}${rateLabel}`;
  }

  return { beltCount, beltTier, rateText };
}
