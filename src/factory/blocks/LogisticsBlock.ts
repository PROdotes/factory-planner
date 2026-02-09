/**
 * ROLE: Domain Model (Logistics Block)
 * PURPOSE: Represents a junction that can split/merge any number of inputs/outputs.
 */

import { BlockBase } from "../core/BlockBase";
import { LogisticsBlock as LogisticsDTO } from "../core/factory.types";

export class LogisticsBlock extends BlockBase {
  constructor(id: string, x: number, y: number) {
    super(id, "logistics", x, y, "Junction");
  }

  toDTO(): LogisticsDTO {
    return {
      id: this.id,
      name: this.name,
      type: "logistics",
      position: { ...this.position },
      demand: { ...this.demand },
      supply: { ...this.supply },
      output: { ...this.output },
      requested: { ...this.requested },
      satisfaction: this.satisfaction,
      sourceYield: this.sourceYield,
      done: this.done,
      results: {
        flows: { ...this.results.flows },
        satisfaction: this.results.satisfaction,
      },
    };
  }
}
