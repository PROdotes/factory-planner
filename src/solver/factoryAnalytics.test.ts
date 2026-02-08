import { describe, it, expect } from "vitest";
import { computeFactoryAnalytics } from "./factoryAnalytics";
import { FactoryGraph } from "../factory/core/FactoryGraph";
import { ProductionBlock } from "../factory/blocks/ProductionBlock";
import { GathererBlock } from "../factory/blocks/GathererBlock";
import { Recipe, Machine } from "../gamedata/gamedata.types";

// Mock Data
const machines: Record<string, Machine> = {
  "smelter-1": {
    id: "smelter-1",
    speed: 1,
    consumption: 360000,
    idleConsumption: 12000,
    generation: 0,
  }, // 360kW, 12kW Idle
  "smelter-2": {
    id: "smelter-2",
    speed: 2,
    consumption: 720000,
    idleConsumption: 24000,
    generation: 0,
  },
  "miner-1": {
    id: "miner-1",
    speed: 1,
    consumption: 420000,
    idleConsumption: 16000,
    generation: 0,
  },
  "wind-turbine": {
    id: "wind-turbine",
    speed: 1,
    consumption: 0,
    idleConsumption: 0,
    generation: 300000,
  }, // 300kW Gen
};

const recipes: Record<string, Recipe> = {
  ingot: {
    id: "ingot",
    name: "Ingot",
    machineId: "smelter-1",
    category: "production",
    craftingTime: 1,
    inputs: [],
    outputs: [{ itemId: "iron", amount: 1 }],
  },
};

describe("computeFactoryAnalytics (Player-Centric)", () => {
  it("should calculate max potential power consumption based on installed machines", () => {
    const factory = new FactoryGraph();

    // Block 1: 10 Smelters (Mk1)
    const block = new ProductionBlock("b1", "Smelter Array", 0, 0);
    block.setRecipe("ingot");
    block.setMachine("smelter-1");
    block.machineCount = 10;
    // Even if flow is 0, we expect power for 10 machines because they are built
    block.results.flows["iron"] = { actual: 0, desired: 0 };
    factory.blocks.set(block.id, block);

    const analytics = computeFactoryAnalytics(factory, recipes, machines);

    // Max Power: 10 * 360kW = 3.6 MW (3,600,000 W)
    expect(analytics.totalActivePower).toBe(3600000);

    // Idle Power: 10 * 12kW = 120 kW (120,000 W)
    expect(analytics.totalIdlePower).toBe(120000);
  });

  it("should include Gatherer blocks (Miners) in power calc", () => {
    const factory = new FactoryGraph();
    const miner = new GathererBlock("m1", "Miner", 0, 0);
    miner.setMachine("miner-1");
    miner.machineCount = 5;
    factory.blocks.set(miner.id, miner);

    const analytics = computeFactoryAnalytics(factory, recipes, machines);

    // Max Power: 5 * 420kW = 2.1 MW
    expect(analytics.totalActivePower).toBe(2100000);
    // Idle Power: 5 * 16kW = 80 kW
    expect(analytics.totalIdlePower).toBe(80000);
  });

  it("should offset consumption with generation", () => {
    const factory = new FactoryGraph();

    // 1 Smelter: 360kW load
    const consumer = new ProductionBlock("b1", "Consumer", 0, 0);
    consumer.setRecipe("ingot");
    consumer.setMachine("smelter-1");
    consumer.machineCount = 1;

    // 2 Turbines: 2 * 300kW = 600kW gen
    const generator = new ProductionBlock("g1", "Gen", 0, 0);
    generator.setMachine("wind-turbine");
    generator.machineCount = 2; // Treat generators as ProductionBlocks for now? Or generic blocks?
    // Wait, generators in DSP are usually placed individually but our planner might group them.
    // Assuming ProductionBlock handles machines without recipes fine (as per code).

    factory.blocks.set(consumer.id, consumer);
    factory.blocks.set(generator.id, generator);

    const analytics = computeFactoryAnalytics(factory, recipes, machines);

    // Net Active Power = 360kW - 600kW = -240kW (Surplus)
    expect(analytics.totalActivePower).toBe(-240000);
  });

  it("should prioritize user-selected machine tier", () => {
    const factory = new FactoryGraph();
    const block = new ProductionBlock("b1", "Upgraded Smelters", 0, 0);
    block.setRecipe("ingot"); // Default smelter-1
    block.setMachine("smelter-2"); // User upgrade
    block.machineCount = 1;
    factory.blocks.set(block.id, block);

    const analytics = computeFactoryAnalytics(factory, recipes, machines);

    // Should use Smelter Mk2 consumption (720kW)
    expect(analytics.totalActivePower).toBe(720000);
  });
});
