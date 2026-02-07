import { describe, it, expect } from "vitest";
import { solveFlowRates } from "./solveRates";
import { FactoryLayout, ProductionBlock } from "../factory/core/factory.types";
import { Recipe, Machine } from "../gamedata/gamedata.types";

describe("Miner Regression Tests", () => {
  const recipes: Record<string, Recipe> = {
    "iron-ore": {
      id: "iron-ore",
      name: "Iron Ore",
      machineId: "miner",
      category: "Gathering",
      inputs: [],
      outputs: [{ itemId: "iron-ore", amount: 1 }],
      craftingTime: 2, // 0.5/sec = 30/min at speed 1.0
    },
    "iron-ingot": {
      id: "iron-ingot",
      name: "Iron Ingot",
      machineId: "smelter",
      category: "production",
      inputs: [{ itemId: "iron-ore", amount: 1 }],
      outputs: [{ itemId: "iron-ingot", amount: 1 }],
      craftingTime: 1, // 1.0/sec
    },
  };

  const machines: Record<string, Machine> = {
    miner: { id: "miner", speed: 1.0, consumption: 0, idleConsumption: 0 },
    smelter: { id: "smelter", speed: 1.0, consumption: 0, idleConsumption: 0 },
  };

  it("Miner output should be determined by Veins (sourceYield) NOT machine count", () => {
    const graph: FactoryLayout = {
      blocks: {
        miner: {
          id: "miner",
          name: "Miner",
          position: { x: 0, y: 0 },
          type: "production",
          recipeId: "iron-ore",
          machineCount: 5, // 5 machines...
          sourceYield: 1.0, // ...covering only 1 vein
          demand: {},
          supply: {},
          output: {},
          satisfaction: 1.0,
          results: { flows: {}, satisfaction: 1.0 },
        } as ProductionBlock,
        sink: {
          id: "sink",
          name: "Sink",
          position: { x: 100, y: 0 },
          type: "production",
          demand: { "iron-ore": 100 }, // Huge demand
          supply: {},
          output: {},
          satisfaction: 1.0,
          results: { flows: {}, satisfaction: 1.0 },
        } as ProductionBlock,
      },
      connections: [
        {
          id: "e1",
          sourceBlockId: "miner",
          targetBlockId: "sink",
          itemId: "iron-ore",
          demand: 0,
          rate: 0,
        },
      ],
    };

    const result = solveFlowRates(graph, recipes, machines);
    const miner = result.blocks.miner as ProductionBlock;
    const flow = miner.results.flows["iron-ore"];

    // Base rate is 0.5/sec. Multiplier should be sourceYield (1.0).
    expect(flow.capacity).toBe(0.5);
    expect(flow.sent).toBe(0.5);
    expect(flow.sent).not.toBe(2.5);
  });

  it("Standard machines should be determined by machine count", () => {
    const graph: FactoryLayout = {
      blocks: {
        src: {
          id: "src",
          name: "Src",
          type: "production",
          position: { x: 0, y: 0 },
          demand: { "iron-ore": 100 },
          sourceYield: 100,
          supply: { "iron-ore": 100 },
          output: { "iron-ore": 100 },
          results: { flows: {}, satisfaction: 1.0 },
        } as any,
        smelter: {
          id: "smelter",
          name: "Smelter",
          position: { x: 100, y: 0 },
          type: "production",
          recipeId: "iron-ingot",
          machineCount: 4,
          demand: {},
          supply: {},
          output: {},
          satisfaction: 1.0,
          results: { flows: {}, satisfaction: 1.0 },
        } as ProductionBlock,
        sink: {
          id: "sink",
          name: "Sink",
          position: { x: 200, y: 0 },
          type: "production",
          demand: { "iron-ingot": 100 },
          results: { flows: {}, satisfaction: 1.0 },
        } as any,
      },
      connections: [
        {
          id: "e1",
          sourceBlockId: "src",
          targetBlockId: "smelter",
          itemId: "iron-ore",
          demand: 0,
          rate: 0,
        },
        {
          id: "e2",
          sourceBlockId: "smelter",
          targetBlockId: "sink",
          itemId: "iron-ingot",
          demand: 0,
          rate: 0,
        },
      ],
    };

    const result = solveFlowRates(graph, recipes, machines);
    const smelter = result.blocks.smelter as ProductionBlock;
    const flow = smelter.results.flows["iron-ingot"];

    // Base rate is 1.0/sec. 4 machines. Should be 4.0/sec.
    expect(flow.capacity).toBe(4.0);
    expect(flow.sent).toBe(4.0);
  });
});
