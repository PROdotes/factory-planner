/**
 * ROLE: Serialization Utility
 * PURPOSE: Converts the FactoryGraph (OOP) to/from JSON for persistence or export.
 */

import { FactoryGraph } from "./core/FactoryGraph";
import { FactoryLayout } from "./core/factory.types";
import { ProductionBlock } from "./blocks/ProductionBlock";
import { LogisticsBlock } from "./blocks/LogisticsBlock";
import { GathererBlock } from "./blocks/GathererBlock";
import { Recipe, Gatherer } from "../gamedata/gamedata.types";

export function serializeGraph(factory: FactoryGraph): string {
  const dto = factory.toDTO();
  return JSON.stringify(dto, null, 2);
}

export function deserializeGraph(
  json: string,
  factory: FactoryGraph,
  recipes?: Record<string, Recipe>,
  gatherers?: Record<string, Gatherer>
) {
  const data: FactoryLayout = JSON.parse(json);

  // Clear current state
  factory.blocks.clear();
  factory.connections = [];

  // 1. Rebuild Blocks
  Object.values(data.blocks).forEach((b) => {
    // Migration: Handle old 'block' and 'sink' types as the new 'production' type
    // Also migrate old production blocks with Gathering recipes to gatherer type
    const prod = b as any;
    const recipe = recipes?.[prod.recipeId];
    const isGatheringRecipe = recipe?.category === "Gathering";

    if (
      b.type === "gatherer" ||
      (b.type === "production" && isGatheringRecipe)
    ) {
      // New gatherer type OR migrated production block with Gathering recipe
      const block = new GathererBlock(
        prod.id,
        prod.name,
        prod.position.x,
        prod.position.y
      );
      // Handle both new gathererId and legacy recipeId (for migration)
      let gathererId = prod.gathererId || null;

      // If no gathererId but we have a recipeId and gatherers map, try to migrate
      if (!gathererId && prod.recipeId && gatherers) {
        if (gatherers[prod.recipeId]) {
          gathererId = prod.recipeId;
        }
      }

      block.setGatherer(gathererId);
      block.setMachine(prod.machineId || null);
      block.sourceYield = prod.sourceYield ?? 6.0;
      block.machineCount = prod.machineCount ?? 1;
      block.syncState(prod);
      factory.blocks.set(block.id, block);
    } else if (
      b.type === "production" ||
      (b as any).type === "block" ||
      (b as any).type === "sink"
    ) {
      const block = new ProductionBlock(
        prod.id,
        prod.name,
        prod.position.x,
        prod.position.y
      );
      block.setRecipe(prod.recipeId || null);
      block.setMachine(prod.machineId || null);
      block.machineCount = prod.machineCount ?? 1;
      block.syncState(prod);
      factory.blocks.set(block.id, block);
    } else if (b.type === "logistics") {
      const logData = b as any;
      const block = new LogisticsBlock(
        logData.id,
        logData.position.x,
        logData.position.y
      );
      block.name = logData.name;
      block.syncState(logData);
      factory.blocks.set(block.id, block);
    }
  });

  // 2. Rebuild Connections
  factory.connections = [...data.connections];
}
