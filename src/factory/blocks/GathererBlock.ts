/**
 * ROLE: Domain Model (Gatherer Block)
 * PURPOSE: Represents resource extraction (Miners, Oil Extractors, Orbital Collectors, Water Pumps).
 * KEY DIFFERENCE: Output is determined by sourceYield (veins/seeps), NOT machine count.
 */

import { BlockBase } from "../core/BlockBase";
import { GathererBlock as GathererDTO } from "../core/factory.types";

export class GathererBlock extends BlockBase {
  gathererId: string | null = null;
  machineId: string | null = null;
  machineCount: number = 1;
  override sourceYield: number = 6.0;

  constructor(id: string, name: string, x: number, y: number) {
    super(id, "gatherer", x, y, name);
  }

  setGatherer(gathererId: string | null) {
    this.gathererId = gathererId;
  }

  setMachine(machineId: string | null) {
    this.machineId = machineId;
  }

  toDTO(): GathererDTO {
    return {
      id: this.id,
      type: "gatherer",
      name: this.name,
      position: { ...this.position },
      gathererId: this.gathererId || undefined,
      machineId: this.machineId || undefined,
      demand: { ...this.demand },
      supply: { ...this.supply },
      output: { ...this.output },
      requested: { ...this.requested },
      satisfaction: this.satisfaction,
      sourceYield: this.sourceYield,
      machineCount: this.machineCount,
      done: this.done,
      results: {
        flows: { ...this.results.flows },
        satisfaction: this.results.satisfaction,
      },
    };
  }

  syncState(data: GathererDTO) {
    super.syncState(data);
    if (data.sourceYield !== undefined) {
      this.sourceYield = data.sourceYield;
    }
    if (data.machineCount !== undefined) {
      this.machineCount = data.machineCount;
    }
    if (data.machineId !== undefined) {
      this.machineId = data.machineId;
    }
    if (data.gathererId !== undefined) {
      this.gathererId = data.gathererId;
    }
  }
}
