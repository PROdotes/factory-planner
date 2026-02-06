/**
 * ROLE: Domain Model (Production Block)
 * PURPOSE: Represents a production machine (Smelter, Assembler) with a Recipe.
 */

import { BlockBase } from "../core/BlockBase";
import { ProductionBlock as ProductionDTO } from "../core/factory.types";

export class ProductionBlock extends BlockBase {
  recipeId: string | null = null;
  machineId: string | null = null;
  machineCount: number = 1;

  constructor(id: string, name: string, x: number, y: number) {
    super(id, "block", x, y, name);
  }

  setRecipe(recipeId: string | null) {
    this.recipeId = recipeId;
  }

  setMachine(machineId: string | null) {
    this.machineId = machineId;
  }

  toDTO(): ProductionDTO {
    return {
      id: this.id,
      type: "block",
      name: this.name,
      recipeId: this.recipeId || undefined,
      machineId: this.machineId || undefined,
      demand: { ...this.demand },
      supply: { ...this.supply },
      output: { ...this.output },
      requested: { ...this.requested },
      satisfaction: this.satisfaction,
      sourceYield: this.sourceYield,
      machineCount: this.machineCount,
      results: {
        flows: { ...this.results.flows },
        satisfaction: this.results.satisfaction,
      },
    };
  }

  syncState(data: ProductionDTO) {
    super.syncState(data);
    if (data.machineCount !== undefined) {
      this.machineCount = data.machineCount;
    }
    if (data.machineId !== undefined) {
      this.machineId = data.machineId;
    }
  }
}
