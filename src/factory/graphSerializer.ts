/**
 * ROLE: Serialization Utility
 * PURPOSE: Converts the FactoryGraph (OOP) to/from JSON for persistence or export.
 */

import { FactoryGraph } from "./core/FactoryGraph";
import { FactoryLayout } from "./core/factory.types";
import { ProductionBlock } from "./blocks/ProductionBlock";
import { StorageBlock } from "./blocks/StorageBlock";
import { LogisticsBlock } from "./blocks/LogisticsBlock";

export function serializeGraph(factory: FactoryGraph): string {
  const dto = factory.toDTO();
  return JSON.stringify(dto, null, 2);
}

export function deserializeGraph(json: string, factory: FactoryGraph) {
  const data: FactoryLayout = JSON.parse(json);

  // Clear current state
  factory.blocks.clear();
  factory.connections = [];

  // 1. Rebuild Blocks
  Object.values(data.blocks).forEach((b) => {
    if (b.type === "block") {
      const prod = b as any;
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
    } else if (b.type === "sink") {
      const sinkData = b as any;
      const block = new StorageBlock(
        sinkData.id,
        sinkData.name,
        sinkData.position.x,
        sinkData.position.y
      );
      block.syncState(sinkData);
      factory.blocks.set(block.id, block);
    } else if (b.type === "logistics") {
      const logData = b as any;
      const block = new LogisticsBlock(
        logData.id,
        logData.subtype,
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
