import { describe, it, expect } from "vitest";
import { solveFlowRates } from "./solveRates";
import {
  FactoryLayout,
  ProductionBlock,
  StorageBlock,
  Connection,
  FactoryBlock,
} from "../factory/core/factory.types";
import { Recipe, Machine } from "../gamedata/gamedata.types";

// ── Test Helpers ────────────────────────────────────────────────────

function makeSource(
  id: string,
  itemId: string,
  capacity: number
): ProductionBlock {
  // Sources are now ProductionBlocks with mining recipes - use sourceYield to set capacity
  return {
    id,
    type: "block",
    name: id,
    recipeId: `mining-${itemId}`,
    demand: {},
    supply: {},
    output: {},
    requested: { [itemId]: capacity },
    satisfaction: 1.0,
    sourceYield: capacity,
    results: { flows: {}, satisfaction: 1.0 },
  };
}

function makeBlock(id: string, recipeId: string): ProductionBlock {
  return {
    id,
    type: "block",
    name: id,
    recipeId,
    demand: {},
    supply: {},
    output: {},
    satisfaction: 1.0,
    results: { flows: {}, satisfaction: 1.0 },
  } as ProductionBlock;
}

function makeSink(id: string, itemId: string, demand: number): StorageBlock {
  return {
    id,
    type: "sink",
    name: id,
    demand: { [itemId]: demand },
    supply: {},
    output: {},
    satisfaction: 1.0,
    results: { flows: {}, satisfaction: 1.0 },
  };
}

function makeEdge(
  id: string,
  src: string,
  tgt: string,
  itemId: string
): Connection {
  return {
    id,
    sourceBlockId: src,
    targetBlockId: tgt,
    itemId,
    demand: 0,
    rate: 0,
  };
}

function makeRecipe(
  id: string,
  inputs: { itemId: string; amount: number }[],
  outputs: { itemId: string; amount: number }[],
  craftingTime: number,
  machineId = "assembler"
): Recipe {
  return {
    id,
    name: id,
    machineId,
    inputs,
    outputs,
    craftingTime,
    category: "production",
  };
}

function edge(result: FactoryLayout, id: string) {
  return result.connections.find((e) => e.id === id)!;
}

function block(result: FactoryLayout, id: string) {
  return result.blocks[id] as ProductionBlock;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("rateSolver", () => {
  // ── Linear Chain (existing) ─────────────────────────────────────

  describe("linear chain", () => {
    const recipes: Record<string, Recipe> = {
      "iron-ingot": makeRecipe(
        "iron-ingot",
        [{ itemId: "iron-ore", amount: 2 }],
        [{ itemId: "iron-ingot", amount: 1 }],
        1
      ),
    };

    it("should propagate demand from sink to source", () => {
      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "iron-ore", 10),
          blk: makeBlock("blk", "iron-ingot"),
          snk: makeSink("snk", "iron-ingot", 1.0),
        },
        connections: [
          makeEdge("e1", "src", "blk", "iron-ore"),
          makeEdge("e2", "blk", "snk", "iron-ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      expect(block(result, "blk").demand["iron-ore"]).toBe(2.0);
      expect(edge(result, "e1").demand).toBe(2.0);
      expect(edge(result, "e1").rate).toBe(2.0);
      expect(block(result, "blk").satisfaction).toBe(1.0);
      expect(edge(result, "e2").rate).toBe(1.0);
    });
  });

  // ── Bottleneck ──────────────────────────────────────────────────

  describe("bottleneck", () => {
    it("should reduce satisfaction when source is limited", () => {
      const recipes: Record<string, Recipe> = {
        "iron-ingot": makeRecipe(
          "iron-ingot",
          [{ itemId: "iron-ore", amount: 2 }],
          [{ itemId: "iron-ingot", amount: 1 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "iron-ore", 0.5),
          blk: makeBlock("blk", "iron-ingot"),
          snk: makeSink("snk", "iron-ingot", 1.0),
        },
        connections: [
          makeEdge("e1", "src", "blk", "iron-ore"),
          makeEdge("e2", "blk", "snk", "iron-ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      expect(block(result, "blk").satisfaction).toBe(0.25);
      expect(edge(result, "e2").rate).toBe(0.25);
    });
  });

  // ── Multi-Output Recipe ─────────────────────────────────────────

  describe("multi-output recipe", () => {
    it("should handle oil refining (crude → refined oil + hydrogen)", () => {
      const recipes: Record<string, Recipe> = {
        "oil-refining": makeRecipe(
          "oil-refining",
          [{ itemId: "crude-oil", amount: 2 }],
          [
            { itemId: "refined-oil", amount: 2 },
            { itemId: "hydrogen", amount: 1 },
          ],
          4
        ),
      };

      const refinery = makeBlock("refinery", "oil-refining") as ProductionBlock;
      refinery.machineCount = 100; // High capacity to avoid capacity limiting

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "crude-oil", 100),
          refinery,
          sinkOil: makeSink("sinkOil", "refined-oil", 1.0),
          sinkH: makeSink("sinkH", "hydrogen", 0.5),
        },
        connections: [
          makeEdge("e1", "src", "refinery", "crude-oil"),
          makeEdge("e2", "refinery", "sinkOil", "refined-oil"),
          makeEdge("e3", "refinery", "sinkH", "hydrogen"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Sink demands: refined oil 1.0/s, hydrogen 0.5/s
      // Rate per machine: refined oil = 2/4 = 0.5/s, hydrogen = 1/4 = 0.25/s
      // Scale for refined oil: 1.0 / 0.5 = 2.0
      // Scale for hydrogen: 0.5 / 0.25 = 2.0
      // maxScale = 2.0
      // Input demand: crude oil = 2.0 * (2/4) = 1.0/s
      expect(block(result, "refinery").demand["crude-oil"]).toBeCloseTo(1.0);
      expect(edge(result, "e2").rate).toBeCloseTo(1.0);
      expect(edge(result, "e3").rate).toBeCloseTo(0.5);
      expect(block(result, "refinery").satisfaction).toBeCloseTo(1.0);
    });

    it("should scale to highest-demand output", () => {
      const recipes: Record<string, Recipe> = {
        "oil-refining": makeRecipe(
          "oil-refining",
          [{ itemId: "crude-oil", amount: 2 }],
          [
            { itemId: "refined-oil", amount: 2 },
            { itemId: "hydrogen", amount: 1 },
          ],
          4
        ),
      };

      // Demand 4.0/s refined oil but only 0.1/s hydrogen
      // refined oil scale: 4.0 / 0.5 = 8.0
      // hydrogen scale: 0.1 / 0.25 = 0.4
      // maxScale = 8.0 → driven by refined oil demand
      const refinery = makeBlock("refinery", "oil-refining") as ProductionBlock;
      refinery.machineCount = 100; // High capacity to avoid capacity limiting

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "crude-oil", 100),
          refinery,
          sinkOil: makeSink("sinkOil", "refined-oil", 4.0),
          sinkH: makeSink("sinkH", "hydrogen", 0.1),
        },
        connections: [
          makeEdge("e1", "src", "refinery", "crude-oil"),
          makeEdge("e2", "refinery", "sinkOil", "refined-oil"),
          makeEdge("e3", "refinery", "sinkH", "hydrogen"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // maxScale=8 → crude demand = 8 * 0.5 = 4.0/s
      expect(block(result, "refinery").demand["crude-oil"]).toBeCloseTo(4.0);
      // Refined oil: fully demanded
      expect(edge(result, "e2").rate).toBeCloseTo(4.0);
      // Hydrogen: overproduced (8 * 0.25 = 2.0 available, only 0.1 demanded)
      // Output is demand*satisfaction = demand of edge * sat
      // Since all supply is available, hydrogen output = 2.0 but sink only wants 0.1
      // The edge demand for hydrogen is 0.1, so rate follows demand ratio
      expect(edge(result, "e3").rate).toBeCloseTo(0.1);
    });
  });

  // ── Cyclic Loop ─────────────────────────────────────────────────

  describe("cyclic recipes", () => {
    it("should converge on oil + X-ray cracking hydrogen loop", () => {
      // Oil refining: 2 crude → 2 refined + 1 hydrogen
      // X-ray cracking: 1 refined + 2 hydrogen → 3 hydrogen + 1 refined
      // Loop: refinery hydrogen → cracking, cracking refined → refinery
      const recipes: Record<string, Recipe> = {
        "oil-refining": makeRecipe(
          "oil-refining",
          [{ itemId: "crude-oil", amount: 2 }],
          [
            { itemId: "refined-oil", amount: 2 },
            { itemId: "hydrogen", amount: 1 },
          ],
          4
        ),
        "xray-cracking": makeRecipe(
          "xray-cracking",
          [
            { itemId: "refined-oil", amount: 1 },
            { itemId: "hydrogen", amount: 2 },
          ],
          [
            { itemId: "hydrogen", amount: 3 },
            { itemId: "refined-oil", amount: 1 },
          ],
          4
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          srcCrude: makeSource("srcCrude", "crude-oil", 100),
          refinery: makeBlock("refinery", "oil-refining"),
          cracker: makeBlock("cracker", "xray-cracking"),
          sinkH: makeSink("sinkH", "hydrogen", 1.0),
        },
        connections: [
          makeEdge("crude-in", "srcCrude", "refinery", "crude-oil"),
          // Refinery → Cracker (refined oil)
          makeEdge("ref-to-crack-oil", "refinery", "cracker", "refined-oil"),
          // Refinery → Cracker (hydrogen from refinery)
          makeEdge("ref-to-crack-h", "refinery", "cracker", "hydrogen"),
          // Cracker → Refinery (refined oil loop back)
          makeEdge("crack-to-ref-oil", "cracker", "refinery", "refined-oil"),
          // Cracker → Sink (net hydrogen output)
          makeEdge("crack-to-sink-h", "cracker", "sinkH", "hydrogen"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // The system should converge to stable values
      expect(block(result, "refinery").satisfaction).toBeGreaterThan(0);
      expect(block(result, "cracker").satisfaction).toBeGreaterThan(0);
      expect(edge(result, "crack-to-sink-h").rate).toBeGreaterThan(0);

      // Verify convergence: all rates should be finite and non-negative
      for (const e of result.connections) {
        expect(e.rate).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(e.rate)).toBe(true);
      }
    });

    it("should handle self-consuming feedback (proliferator-like)", () => {
      // Simplified: recipe uses 0.1 of its own output per craft
      // 1 crystal + 0.1 proliferator → 1 proliferator
      const recipes: Record<string, Recipe> = {
        proliferator: makeRecipe(
          "proliferator",
          [
            { itemId: "crystal", amount: 1 },
            { itemId: "proliferator", amount: 0.1 },
          ],
          [{ itemId: "proliferator", amount: 1 }],
          0.5
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          srcCrystal: makeSource("srcCrystal", "crystal", 100),
          maker: makeBlock("maker", "proliferator"),
          sinkProf: makeSink("sinkProf", "proliferator", 1.0),
        },
        connections: [
          makeEdge("crystal-in", "srcCrystal", "maker", "crystal"),
          makeEdge("prof-out", "maker", "sinkProf", "proliferator"),
          // Self-loop: maker feeds itself
          makeEdge("prof-loop", "maker", "maker", "proliferator"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Net output should be positive (production exceeds self-consumption)
      expect(edge(result, "prof-out").rate).toBeGreaterThan(0);
      expect(block(result, "maker").satisfaction).toBeGreaterThan(0);

      // Self-loop should carry some flow
      expect(edge(result, "prof-loop").rate).toBeGreaterThan(0);
    });
  });

  // ── Deep Chain ──────────────────────────────────────────────────

  describe("deep production chain", () => {
    it("should propagate through 5-step chain correctly", () => {
      // Chain: ore → ingot → circuit → processor → module → sink
      // Each step: 2 input → 1 output, 1s craft time
      const recipes: Record<string, Recipe> = {};
      const items = ["ore", "ingot", "circuit", "processor", "module"];

      for (let i = 0; i < items.length - 1; i++) {
        recipes[`r${i}`] = makeRecipe(
          `r${i}`,
          [{ itemId: items[i], amount: 2 }],
          [{ itemId: items[i + 1], amount: 1 }],
          1
        );
      }

      const nodes: Record<string, FactoryBlock> = {
        src: makeSource("src", "ore", 1000),
        snk: makeSink("snk", "module", 1.0),
      };
      const edges: Connection[] = [];

      // Create blocks and edges for each step
      for (let i = 0; i < items.length - 1; i++) {
        const blk = makeBlock(`b${i}`, `r${i}`) as ProductionBlock;
        blk.machineCount = 100; // High capacity to avoid capacity limiting
        nodes[`b${i}`] = blk;
      }

      // Wire: src → b0
      edges.push(makeEdge("e-src", "src", "b0", "ore"));
      // Wire: b0 → b1 → b2 → b3
      for (let i = 0; i < items.length - 2; i++) {
        edges.push(makeEdge(`e${i}`, `b${i}`, `b${i + 1}`, items[i + 1]));
      }
      // Wire: b3 → sink
      edges.push(makeEdge("e-snk", `b${items.length - 2}`, "snk", "module"));

      const graph: FactoryLayout = { blocks: nodes, connections: edges };
      const result = solveFlowRates(graph, recipes);

      // Demand at source should be 2^4 = 16 (each step doubles)
      expect(edge(result, "e-src").demand).toBeCloseTo(16.0);
      expect(edge(result, "e-src").rate).toBeCloseTo(16.0);
      expect(edge(result, "e-snk").rate).toBeCloseTo(1.0);

      // All blocks should be fully satisfied
      for (let i = 0; i < items.length - 1; i++) {
        expect(block(result, `b${i}`).satisfaction).toBeCloseTo(1.0);
      }
    });
  });

  // ── Fan-In ──────────────────────────────────────────────────────

  describe("fan-in", () => {
    it("should merge multiple sources into one block", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 4 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          srcA: makeSource("srcA", "ore", 3),
          srcB: makeSource("srcB", "ore", 1),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("eA", "srcA", "blk", "ore"),
          makeEdge("eB", "srcB", "blk", "ore"),
          makeEdge("eOut", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Total ore needed: 4/s. Sources: A=3, B=1 → total 4, should satisfy
      const rateA = edge(result, "eA").rate;
      const rateB = edge(result, "eB").rate;
      expect(rateA + rateB).toBeCloseTo(4.0);
      expect(block(result, "blk").satisfaction).toBeCloseTo(1.0);
      expect(edge(result, "eOut").rate).toBeCloseTo(1.0);
    });

    it("should show bottleneck when total fan-in is insufficient", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 4 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          srcA: makeSource("srcA", "ore", 1),
          srcB: makeSource("srcB", "ore", 1),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("eA", "srcA", "blk", "ore"),
          makeEdge("eB", "srcB", "blk", "ore"),
          makeEdge("eOut", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Total available: 2/s, needed: 4/s → satisfaction = 0.5
      expect(block(result, "blk").satisfaction).toBeCloseTo(0.5);
      expect(edge(result, "eOut").rate).toBeCloseTo(0.5);
    });
  });

  // ── Fan-Out ─────────────────────────────────────────────────────

  describe("fan-out", () => {
    it("should distribute supply proportionally to demand", () => {
      const recipes: Record<string, Recipe> = {
        make: makeRecipe(
          "make",
          [{ itemId: "input", amount: 1 }],
          [{ itemId: "output", amount: 4 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "input", 100),
          blk: makeBlock("blk", "make"),
          snkA: makeSink("snkA", "output", 2.0),
          snkB: makeSink("snkB", "output", 1.0),
          snkC: makeSink("snkC", "output", 1.0),
        },
        connections: [
          makeEdge("eIn", "src", "blk", "input"),
          makeEdge("eA", "blk", "snkA", "output"),
          makeEdge("eB", "blk", "snkB", "output"),
          makeEdge("eC", "blk", "snkC", "output"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Total output demand: 4.0/s, block produces 4.0/s
      expect(edge(result, "eA").rate).toBeCloseTo(2.0);
      expect(edge(result, "eB").rate).toBeCloseTo(1.0);
      expect(edge(result, "eC").rate).toBeCloseTo(1.0);
      expect(block(result, "blk").satisfaction).toBeCloseTo(1.0);
    });

    it("should distribute limited supply proportionally when bottlenecked", () => {
      const recipes: Record<string, Recipe> = {
        make: makeRecipe(
          "make",
          [{ itemId: "input", amount: 1 }],
          [{ itemId: "output", amount: 4 }],
          1
        ),
      };

      // Source can only provide 0.5 input → 2.0 output (half of 4.0 demanded)
      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "input", 0.5),
          blk: makeBlock("blk", "make"),
          snkA: makeSink("snkA", "output", 2.0),
          snkB: makeSink("snkB", "output", 2.0),
        },
        connections: [
          makeEdge("eIn", "src", "blk", "input"),
          makeEdge("eA", "blk", "snkA", "output"),
          makeEdge("eB", "blk", "snkB", "output"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Satisfaction = 0.5/1.0 = 0.5, each sink gets half its demand
      expect(block(result, "blk").satisfaction).toBeCloseTo(0.5);
      expect(edge(result, "eA").rate).toBeCloseTo(1.0);
      expect(edge(result, "eB").rate).toBeCloseTo(1.0);
    });
  });

  // ── Machine Speed ───────────────────────────────────────────────

  describe("machine speed multiplier", () => {
    const recipe = makeRecipe(
      "smelt",
      [{ itemId: "ore", amount: 2 }],
      [{ itemId: "ingot", amount: 1 }],
      2, // 2s base craft time
      "smelter"
    );

    it("should apply machine speed to effective craft time", () => {
      const recipes = { smelt: recipe };
      const machines: Record<string, Machine> = {
        smelter: {
          id: "smelter",
          speed: 2.0,
          consumption: 0,
          idleConsumption: 0,
        },
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 100),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("eIn", "src", "blk", "ore"),
          makeEdge("eOut", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes, machines);

      // With speed 2x: effective time = 2/2 = 1s
      // Rate per machine: ingot = 1/1 = 1/s, ore = 2/1 = 2/s
      // Scale to produce 1.0/s ingot: scale = 1.0
      // Ore demand = 1.0 * 2.0 = 2.0/s
      expect(block(result, "blk").demand["ore"]).toBeCloseTo(2.0);
      expect(edge(result, "eOut").rate).toBeCloseTo(1.0);
    });

    it("should default to speed 1.0 when machines not provided", () => {
      const recipes = { smelt: recipe };

      const blk = makeBlock("blk", "smelt") as ProductionBlock;
      blk.machineCount = 100; // High capacity to avoid capacity limiting

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 100),
          blk,
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("eIn", "src", "blk", "ore"),
          makeEdge("eOut", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Without speed: effective time = 2s
      // Rate per machine: ingot = 1/2 = 0.5/s, ore = 2/2 = 1/s
      // Scale to produce 1.0/s ingot: scale = 2.0
      // Ore demand = 2.0 * 1.0 = 2.0/s
      expect(block(result, "blk").demand["ore"]).toBeCloseTo(2.0);
      expect(edge(result, "eOut").rate).toBeCloseTo(1.0);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty graph", () => {
      const graph: FactoryLayout = { blocks: {}, connections: [] };
      const result = solveFlowRates(graph, {});
      expect(result.connections).toHaveLength(0);
    });

    it("should handle graph with no edges", () => {
      const graph: FactoryLayout = {
        blocks: { src: makeSource("src", "ore", 10) },
        connections: [],
      };
      const result = solveFlowRates(graph, {});
      expect(Object.keys(result.blocks)).toHaveLength(1);
    });

    it("should handle block with missing recipe", () => {
      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 10),
          blk: makeBlock("blk", "nonexistent"),
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, {});

      // Block should be skipped, satisfaction stays at default
      expect(block(result, "blk").satisfaction).toBe(1.0);
      expect(edge(result, "e2").rate).toBe(0);
    });

    it("should handle invalid machine speed gracefully", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 2 }],
          [{ itemId: "ingot", amount: 1 }],
          1,
          "smelter"
        ),
      };
      const machines: Record<string, Machine> = {
        smelter: {
          id: "smelter",
          speed: 0,
          consumption: 0,
          idleConsumption: 0,
        },
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 10),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 1.0),
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes, machines);

      expect(block(result, "blk").satisfaction).toBe(0);
      expect(edge(result, "e1").rate).toBe(0);
      expect(edge(result, "e2").rate).toBe(0);
    });

    it("should handle zero demand", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 2 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 10),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 0),
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      expect(edge(result, "e1").rate).toBeCloseTo(0);
      expect(edge(result, "e2").rate).toBeCloseTo(0);
    });

    it("should handle disconnected nodes gracefully", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 2 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 10),
          blk: makeBlock("blk", "smelt"),
          snk: makeSink("snk", "ingot", 1.0),
          isolated: makeSource("isolated", "copper", 5),
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Connected chain works normally
      expect(edge(result, "e2").rate).toBeCloseTo(1.0);
      // Isolated node has no meaningful supply flowing
      const isolatedSupply = result.blocks["isolated"].supply["copper"] ?? 0;
      expect(isolatedSupply).toBe(0);
    });
  });

  // ── Performance ─────────────────────────────────────────────────

  describe("performance", () => {
    it("should handle a 50-node graph within reasonable time", () => {
      // Build a wide chain: 10 sources → 10 blocks → 10 blocks → 10 blocks → 10 sinks
      const recipes: Record<string, Recipe> = {};
      const nodes: Record<string, FactoryBlock> = {};
      const edges: Connection[] = [];
      let edgeId = 0;

      // Layer 0: 10 sources
      for (let i = 0; i < 10; i++) {
        nodes[`src${i}`] = makeSource(`src${i}`, `item-a`, 100);
      }

      // Layers 1-3: 10 blocks each
      for (let layer = 1; layer <= 3; layer++) {
        const inItem = `item-${String.fromCharCode(96 + layer)}`; // a, b, c
        const outItem = `item-${String.fromCharCode(97 + layer)}`; // b, c, d
        const rId = `r-layer${layer}`;
        recipes[rId] = makeRecipe(
          rId,
          [{ itemId: inItem, amount: 1 }],
          [{ itemId: outItem, amount: 1 }],
          1
        );

        for (let i = 0; i < 10; i++) {
          const blockId = `b${layer}-${i}`;
          nodes[blockId] = makeBlock(blockId, rId);

          // Connect from previous layer
          const prevId = layer === 1 ? `src${i}` : `b${layer - 1}-${i}`;
          edges.push(makeEdge(`e${edgeId++}`, prevId, blockId, inItem));
        }
      }

      // Layer 4: 10 sinks
      for (let i = 0; i < 10; i++) {
        nodes[`snk${i}`] = makeSink(`snk${i}`, "item-d", 1.0);
        edges.push(makeEdge(`e${edgeId++}`, `b3-${i}`, `snk${i}`, "item-d"));
      }

      const graph: FactoryLayout = { blocks: nodes, connections: edges };

      const start = performance.now();
      const result = solveFlowRates(graph, recipes);
      const elapsed = performance.now() - start;

      // Should complete well under 200ms
      expect(elapsed).toBeLessThan(200);

      // Spot-check: sinks should receive 1.0/s each
      for (let i = 0; i < 10; i++) {
        expect(result.blocks[`snk${i}`].supply["item-d"]).toBeCloseTo(1.0);
      }
    });
  });

  // ── Local Bottleneck (Capacity Constraint) ─────────────────────────

  describe("local bottleneck (capacity constraint)", () => {
    it("should cap consumption when upstream exceeds capacity", () => {
      // Iron mine: 180 ore/s, Smelter can only process 60 ore/s (1 machine, 1s craft, 1 ore input)
      // With recipe: 1 ore -> 1 ingot in 1s, capacity = 1 ore/s per machine
      // So we need machineCount to set capacity. Let's use: 2 ore -> 1 ingot in 1s, machineCount=30 -> 60 ore/s cap
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 2 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const blk = makeBlock("blk", "smelt") as ProductionBlock;
      blk.machineCount = 30; // 30 machines * (2 ore / 1s) = 60 ore/s capacity

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 180), // Provides 180 ore/s
          blk,
          snk: makeSink("snk", "ingot", 500), // Requests 500 ingots/s
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Block should only consume 60 (capacity), not 180 (available)
      expect(block(result, "blk").supply["ore"]).toBeCloseTo(60);

      // Edge rate should reflect actual consumption
      expect(edge(result, "e1").rate).toBeCloseTo(60);

      // Output should be 30 ingots (60 ore / 2 ore per ingot)
      expect(edge(result, "e2").rate).toBeCloseTo(30);

      // Satisfaction = 30/500 = 0.06 (output vs requested)
      expect(block(result, "blk").satisfaction).toBeCloseTo(0.06);

      // FlowResult for input: actual=60 (consumed), demand=180 (available), capacity=60
      const inputFlow = result.blocks["blk"].results.flows["ore"];
      expect(inputFlow.actual).toBeCloseTo(60);
      expect(inputFlow.demand).toBeCloseTo(180);
      expect(inputFlow.capacity).toBeCloseTo(60);
    });

    it("should handle chain of bottlenecks", () => {
      // A produces 100, B can only process 50, C requests 200
      const recipes: Record<string, Recipe> = {
        process: makeRecipe(
          "process",
          [{ itemId: "in", amount: 1 }],
          [{ itemId: "out", amount: 1 }],
          2 // 2s craft time -> 0.5/s per machine
        ),
      };

      const blkB = makeBlock("blkB", "process") as ProductionBlock;
      blkB.machineCount = 100; // 100 machines * (1 / 2s) = 50 in/s capacity

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "in", 100),
          blkB,
          snk: makeSink("snk", "out", 200),
        },
        connections: [
          makeEdge("e1", "src", "blkB", "in"),
          makeEdge("e2", "blkB", "snk", "out"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      expect(edge(result, "e1").rate).toBeCloseTo(50); // Capped by B's capacity
      expect(edge(result, "e2").rate).toBeCloseTo(50); // B outputs 50
      expect(block(result, "blkB").satisfaction).toBeCloseTo(0.25); // 50/200
    });

    it("should handle fan-in with capacity limit", () => {
      // Two sources provide 90 each (180 total), block can only handle 60 total
      const recipes: Record<string, Recipe> = {
        process: makeRecipe(
          "process",
          [{ itemId: "ore", amount: 1 }],
          [{ itemId: "out", amount: 1 }],
          1
        ),
      };

      const blk = makeBlock("blk", "process") as ProductionBlock;
      blk.machineCount = 60; // 60/s input capacity

      const graph: FactoryLayout = {
        blocks: {
          srcA: makeSource("srcA", "ore", 90),
          srcB: makeSource("srcB", "ore", 90),
          blk,
          snk: makeSink("snk", "out", 100),
        },
        connections: [
          makeEdge("eA", "srcA", "blk", "ore"),
          makeEdge("eB", "srcB", "blk", "ore"),
          makeEdge("eOut", "blk", "snk", "out"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Total consumed should be capped at 60
      const rateA = edge(result, "eA").rate;
      const rateB = edge(result, "eB").rate;
      expect(rateA + rateB).toBeCloseTo(60);

      // Rates should be proportional (50/50 since both provide 90)
      expect(rateA).toBeCloseTo(30);
      expect(rateB).toBeCloseTo(30);

      expect(edge(result, "eOut").rate).toBeCloseTo(60);
    });

    it("should handle multi-input recipe where one input is undersupplied", () => {
      // Recipe: 2 iron + 1 copper -> 1 gear
      // Iron supply: 100, Copper supply: 20
      // Capacity: unlimited machines
      // Copper limits production to 20 gears
      const recipes: Record<string, Recipe> = {
        gear: makeRecipe(
          "gear",
          [
            { itemId: "iron", amount: 2 },
            { itemId: "copper", amount: 1 },
          ],
          [{ itemId: "gear", amount: 1 }],
          1
        ),
      };

      const blk = makeBlock("blk", "gear") as ProductionBlock;
      blk.machineCount = 100; // High capacity

      const graph: FactoryLayout = {
        blocks: {
          srcIron: makeSource("srcIron", "iron", 100),
          srcCopper: makeSource("srcCopper", "copper", 20),
          blk,
          snk: makeSink("snk", "gear", 50),
        },
        connections: [
          makeEdge("eIron", "srcIron", "blk", "iron"),
          makeEdge("eCopper", "srcCopper", "blk", "copper"),
          makeEdge("eOut", "blk", "snk", "gear"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Copper limits at 20, which corresponds to 20 gears
      // Iron takes full delivered amount (current behavior - could be optimized later)
      // Satisfaction = min(100/100, 20/50) = 0.4, Output = 50 * 0.4 = 20
      expect(edge(result, "eCopper").rate).toBeCloseTo(20);
      expect(edge(result, "eOut").rate).toBeCloseTo(20);
      expect(block(result, "blk").satisfaction).toBeCloseTo(0.4);
    });

    it("should verify edge rates reflect actual consumption not delivery", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 1 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const blk = makeBlock("blk", "smelt") as ProductionBlock;
      blk.machineCount = 50; // Cap at 50/s

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 100),
          blk,
          snk: makeSink("snk", "ingot", 100),
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Edge rate must reflect consumption (50), not delivery (100)
      expect(edge(result, "e1").rate).toBeCloseTo(50);
      expect(edge(result, "e2").rate).toBeCloseTo(50);
      expect(block(result, "blk").satisfaction).toBeCloseTo(0.5); // 50/100
    });

    it("should show correct FlowResult semantics for inputs and outputs", () => {
      const recipes: Record<string, Recipe> = {
        smelt: makeRecipe(
          "smelt",
          [{ itemId: "ore", amount: 2 }],
          [{ itemId: "ingot", amount: 1 }],
          1
        ),
      };

      const blk = makeBlock("blk", "smelt") as ProductionBlock;
      blk.machineCount = 30; // 60 ore/s capacity, 30 ingot/s output capacity

      const graph: FactoryLayout = {
        blocks: {
          src: makeSource("src", "ore", 180), // Available: 180
          blk,
          snk: makeSink("snk", "ingot", 100), // Requested: 100
        },
        connections: [
          makeEdge("e1", "src", "blk", "ore"),
          makeEdge("e2", "blk", "snk", "ingot"),
        ],
      };

      const result = solveFlowRates(graph, recipes);

      // Input FlowResult: demand=available, actual=consumed, capacity=max input
      const inputFlow = result.blocks["blk"].results.flows["ore"];
      expect(inputFlow.demand).toBeCloseTo(180); // Available from upstream
      expect(inputFlow.actual).toBeCloseTo(60); // Consumed (capped by capacity)
      expect(inputFlow.capacity).toBeCloseTo(60); // Max input rate

      // Output FlowResult: demand=requested, actual=produced, capacity=max output
      const outputFlow = result.blocks["blk"].results.flows["ingot"];
      expect(outputFlow.demand).toBeCloseTo(100); // Requested by downstream
      expect(outputFlow.actual).toBeCloseTo(30); // Produced (limited by input)
      expect(outputFlow.capacity).toBeCloseTo(30); // Max output rate
    });
  });
});
