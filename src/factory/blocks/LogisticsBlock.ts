/**
 * ROLE: Domain Model (Logistics Block)
 * PURPOSE: Represents splitters, mergers, or simple line knots.
 */

import { BlockBase } from "../core/BlockBase";
import { LogisticsBlock as LogisticsDTO } from "../core/factory.types";

export class LogisticsBlock extends BlockBase {
  subtype: LogisticsDTO["subtype"];

  constructor(
    id: string,
    subtype: LogisticsDTO["subtype"],
    x: number,
    y: number
  ) {
    const name = subtype.charAt(0).toUpperCase() + subtype.slice(1);
    super(id, "logistics", x, y, name);
    this.subtype = subtype;
  }

  toDTO(): LogisticsDTO {
    return {
      id: this.id,
      name: this.name,
      type: "logistics",
      position: { ...this.position },
      subtype: this.subtype,
      demand: { ...this.demand },
      supply: { ...this.supply },
      output: { ...this.output },
      requested: { ...this.requested },
      satisfaction: this.satisfaction,
      sourceYield: this.sourceYield,
      results: {
        flows: { ...this.results.flows },
        satisfaction: this.results.satisfaction,
      },
    };
  }
}
