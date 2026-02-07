/**
 * ROLE: The Intelligence (Logical Flow Layer)
 * PURPOSE: Propagates demand backwards and supply forwards via interleaved
 *          convergence loop. Handles cyclic graphs (oil loops, proliferator feedback).
 * INPUT: FlowGraph (nodes/edges), Recipe Dictionary, optional Machine Dictionary
 * OUTPUT: Updated FlowGraph with resolved demand, rate, and satisfaction values.
 */

import {
  FactoryLayout,
  Connection,
  ProductionBlock,
  FlowResult,
} from "../factory/core/factory.types";
import { Recipe, Machine } from "../gamedata/gamedata.types";

const MAX_ITERATIONS = 100;
const EPSILON = 1e-9;
const CONVERGENCE_TOLERANCE = 1e-6;

interface NodeIndex {
  incoming: Map<string, Connection[]>; // itemId -> edges
  outgoing: Map<string, Connection[]>; // itemId -> edges
  incomingAll: Connection[];
  outgoingAll: Connection[];
}

// ── Main Entry Point ────────────────────────────────────────────────

export function solveFlowRates(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines?: Record<string, Machine>
): FactoryLayout {
  if (graph.connections.length === 0) return graph;

  initializeGraph(graph);
  const index = buildAdjacencyIndex(graph);
  const order = computeProcessingOrder(graph, index);

  const prevDemand = new Map<string, number>();
  const prevRate = new Map<string, number>();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    for (const edge of graph.connections) {
      prevDemand.set(edge.id, edge.demand);
      prevRate.set(edge.id, edge.rate);
    }

    backwardPass(graph, recipes, machines, index, order);
    forwardPass(graph, recipes, machines, index, order);
    if (isConverged(graph.connections, prevDemand, prevRate)) break;
  }

  finalizeResults(graph, recipes, machines, index);
  return graph;
}

// ── Initialization ──────────────────────────────────────────────────

function initializeGraph(graph: FactoryLayout): void {
  for (const node of Object.values(graph.blocks)) {
    node.supply = {};
    node.output = {};
    // node.requested = {}; // DO NOT CLEAR: Stores user-defined manual goals
    node.satisfaction = 1.0;

    // Clear hidden delivery metadata
    if ((node as any)._delivered) delete (node as any)._delivered;

    node.results = { flows: {}, satisfaction: 1.0 };

    // DERIVED DEMAND: Reset for blocks that pull based on connections.
    // Production blocks keep their node.demand (user goal) which machine logic will overwrite if needed.
    if (node.type === "logistics") {
      node.demand = {};
    }
  }
  for (const edge of graph.connections) {
    edge.demand = 0;
    // Seed self-loop edges with a tiny rate to bootstrap cyclic convergence.
    edge.rate = edge.sourceBlockId === edge.targetBlockId ? EPSILON : 0;
  }
}

function finalizeResults(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine> | undefined,
  index: Map<string, NodeIndex>
): void {
  for (const node of Object.values(graph.blocks)) {
    const flows: Record<string, FlowResult> = {};
    const itemIds = new Set<string>([
      ...Object.keys(node.demand),
      ...Object.keys(node.supply),
      ...Object.keys(node.output),
      ...Object.keys(node.requested || {}),
    ]);

    const capacities: Record<string, number> = {};
    const nodeIndex = index.get(node.id);

    // Compute what actually flowed out (sum of edge rates after solver converged)
    // This is the REAL output, constrained by both production AND downstream acceptance
    const actualFlowOut: Record<string, number> = {};
    if (nodeIndex) {
      for (const [itemId, edges] of nodeIndex.outgoing) {
        actualFlowOut[itemId] = edges.reduce((sum, e) => sum + e.rate, 0);
      }
    }

    if (node.type === "production") {
      const block = node as ProductionBlock;
      const recipe = block.recipeId ? recipes[block.recipeId] : null;

      if (recipe) {
        // Add recipe items to itemIds so flows always has entries for them
        for (const inp of recipe.inputs) itemIds.add(inp.itemId);
        for (const out of recipe.outputs) itemIds.add(out.itemId);

        const effectiveTime = getEffectiveTime(recipe, machines);
        if (Number.isFinite(effectiveTime) && effectiveTime > 0) {
          const count = block.machineCount ?? 1;
          const yieldMult =
            recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
          for (const out of recipe.outputs) {
            capacities[out.itemId] =
              (out.amount / effectiveTime) * count * yieldMult;
          }
          for (const inp of recipe.inputs) {
            capacities[inp.itemId] = (inp.amount / effectiveTime) * count;
          }
        }
      } else {
        // Stationary Node (Sink/Storage)
        for (const id of Object.keys(node.demand)) {
          capacities[id] = node.demand[id];
        }
      }
    } else if (node.type === "logistics") {
      for (const id of Object.keys(node.demand)) {
        capacities[id] = node.demand[id];
      }
    }

    // For inputs: demand = delivered (available), actual = consumed
    // For outputs: demand = factory max (requested), actual = produced, sent = gated by downstream
    const delivered =
      (node as unknown as Record<string, Record<string, number>>)._delivered ||
      {};

    for (const id of itemIds) {
      const isOutput =
        node.output?.[id] !== undefined ||
        (node.requested && node.requested[id] !== undefined);

      const actualValue = isOutput
        ? node.output?.[id] || 0
        : node.supply?.[id] || 0;
      // sent = what actually flowed out (from edge rates), not what we produced
      const sentValue = isOutput
        ? actualFlowOut[id] ?? actualValue
        : actualValue;

      flows[id] = {
        demand: isOutput
          ? node.requested?.[id] || 0
          : delivered[id] || node.demand[id] || 0,
        actual: actualValue,
        capacity: capacities[id] || 0,
        sent: sentValue,
      };
    }

    node.results = {
      flows,
      satisfaction: node.satisfaction,
    };
  }
}

// ── Adjacency Index ─────────────────────────────────────────────────

function buildAdjacencyIndex(graph: FactoryLayout): Map<string, NodeIndex> {
  const index = new Map<string, NodeIndex>();

  for (const nodeId of Object.keys(graph.blocks)) {
    index.set(nodeId, {
      incoming: new Map(),
      outgoing: new Map(),
      incomingAll: [],
      outgoingAll: [],
    });
  }

  for (const edge of graph.connections) {
    const src = index.get(edge.sourceBlockId);
    const tgt = index.get(edge.targetBlockId);
    if (!src || !tgt) continue;

    if (!src.outgoing.has(edge.itemId)) src.outgoing.set(edge.itemId, []);
    src.outgoing.get(edge.itemId)!.push(edge);
    src.outgoingAll.push(edge);

    if (!tgt.incoming.has(edge.itemId)) tgt.incoming.set(edge.itemId, []);
    tgt.incoming.get(edge.itemId)!.push(edge);
    tgt.incomingAll.push(edge);
  }

  return index;
}

// ── Topological Sort ────────────────────────────────────────────────

function computeProcessingOrder(
  graph: FactoryLayout,
  index: Map<string, NodeIndex>
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) return; // back-edge (cycle) — skip
    visiting.add(nodeId);

    const idx = index.get(nodeId);
    if (idx) {
      for (const edge of idx.outgoingAll) {
        visit(edge.targetBlockId);
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  // Start from real sources (no incoming edges), then sweep remaining
  for (const id of Object.keys(graph.blocks)) {
    const idx = index.get(id);
    if (idx && idx.incomingAll.length === 0) visit(id);
  }
  for (const id of Object.keys(graph.blocks)) {
    visit(id);
  }

  // order is in reverse-topological (post-order). Reverse for forward pass.
  order.reverse();
  return order;
}

// ── Backward Pass ───────────────────────────────────────────────────

function backwardPass(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine> | undefined,
  index: Map<string, NodeIndex>,
  order: string[]
): void {
  // Process sinks → sources (reverse topological)
  for (let i = order.length - 1; i >= 0; i--) {
    const node = graph.blocks[order[i]];
    if (!node) continue;
    const idx = index.get(node.id)!;

    if (node.type === "production") {
      const block = node as ProductionBlock;
      const recipe = block.recipeId ? recipes[block.recipeId] : null;

      if (recipe) {
        const isGatherer = recipe.category === "Gathering";
        const isSourceNode = recipe.inputs.length === 0;

        // 1. Calculate goals for each recipe output
        const outputGoals: Record<string, number> = {};
        const effectiveTime = getEffectiveTime(recipe, machines);

        for (const out of recipe.outputs) {
          const itemId = out.itemId;
          const edgesForItem = idx.outgoingAll.filter(
            (e) => e.itemId === itemId
          );

          if (edgesForItem.length > 0) {
            outputGoals[itemId] = edgesForItem.reduce(
              (sum, e) => sum + e.demand,
              0
            );
          } else {
            // UNCONNECTED OUTPUT
            if (isGatherer || isSourceNode) {
              const yieldMult = block.sourceYield ?? 1.0;
              const count = block.machineCount ?? 1.0;
              const multiplier = isGatherer ? yieldMult : count;
              outputGoals[itemId] = (out.amount / effectiveTime) * multiplier;
            } else {
              outputGoals[itemId] =
                block.requested?.[itemId] || block.demand[itemId] || 0;
            }
          }
        }

        node.requested = outputGoals;
        if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON) {
          block.demand = {};
          for (const inp of recipe.inputs) {
            block.demand[inp.itemId] = 0;
          }
          continue;
        }

        let maxScale = 0;
        for (const out of recipe.outputs) {
          const goal = outputGoals[out.itemId] || 0;
          const multiplier = isGatherer ? block.sourceYield ?? 1.0 : 1.0;
          const ratePerMachine = (out.amount / effectiveTime) * multiplier;
          if (ratePerMachine > EPSILON) {
            const scale = goal / ratePerMachine;
            if (scale > maxScale) maxScale = scale;
          }
        }

        block.demand = {};
        for (const inp of recipe.inputs) {
          const ratePerUnit = inp.amount / effectiveTime;
          block.demand[inp.itemId] = maxScale * ratePerUnit;
        }
      } else {
        // Stationary Node (Sink/Storage)
        node.requested = { ...node.demand };
      }
    } else if (node.type === "logistics") {
      const goals = aggregateEdges(idx.outgoingAll, "demand");
      node.requested = { ...goals };
      node.demand = { ...goals };
    }

    // Distribute this node's demand to its incoming edges
    for (const [itemId, edges] of idx.incoming) {
      const totalDemand = node.demand[itemId] || 0;
      distributeDemand(edges, totalDemand);
    }
  }
}

function distributeDemand(edges: Connection[], totalDemand: number): void {
  if (edges.length === 0) return;
  if (edges.length === 1) {
    edges[0].demand = totalDemand;
    return;
  }

  // Weight by prior-iteration rates for proportional splitting.
  const weights = edges.map((e) => Math.max(e.rate, 0));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  if (totalWeight > EPSILON) {
    for (let i = 0; i < edges.length; i++) {
      edges[i].demand = totalDemand * (weights[i] / totalWeight);
    }
  } else {
    const share = totalDemand / edges.length;
    for (const edge of edges) {
      edge.demand = share;
    }
  }
}

// ── Forward Pass ────────────────────────────────────────────────────

function forwardPass(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine> | undefined,
  index: Map<string, NodeIndex>,
  order: string[]
): void {
  // Process sources → sinks (forward topological)
  for (const nodeId of order) {
    const node = graph.blocks[nodeId];
    if (!node) continue;
    const idx = index.get(nodeId)!;

    let supplyToGive: Record<string, number> = {};

    if (node.type === "production") {
      const block = node as ProductionBlock;

      // 1. Resolve Recipe and Input State
      const recipe = block.recipeId ? recipes[block.recipeId] : null;
      const isSource = recipe
        ? recipe.inputs.length === 0
        : idx.incomingAll.length === 0;

      // 2. CASE A: Stationary Source Block (Storage/Legacy)
      if (isSource && !recipe && block.sourceYield !== undefined) {
        block.satisfaction = 1.0;
        const outgoingDemand = aggregateEdges(idx.outgoingAll, "demand");
        for (const itemId of Object.keys(outgoingDemand)) {
          block.output[itemId] = Math.min(
            outgoingDemand[itemId],
            block.sourceYield!
          );
        }
        supplyToGive = block.output;
      }
      // 3. CASE B: Machines (Gatherers or Assemblers)
      else if (recipe) {
        const effectiveTime = getEffectiveTime(recipe, machines);
        if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON) {
          block.satisfaction = 0;
          block.output = {};
          supplyToGive = block.output;
          continue;
        }

        const blockCapacities = getBlockCapacities(block, recipe, machines);
        const delivered = aggregateEdges(idx.incomingAll, "rate");

        if (isSource) {
          // Sources (Miners) are always satisfied by the ground/infinite input
          block.satisfaction = 1.0;
          block.supply = {};
        } else {
          // Consumers: Cap consumed supply by input capacity
          const consumed: Record<string, number> = {};
          for (const inp of recipe.inputs) {
            const cap = blockCapacities[inp.itemId] ?? Infinity;
            consumed[inp.itemId] = Math.min(delivered[inp.itemId] || 0, cap);
          }
          block.supply = consumed;
          (
            block as unknown as Record<string, Record<string, number>>
          )._delivered = delivered;

          // Update incoming edge rates to reflect actual consumption
          for (const [itemId, edges] of idx.incoming) {
            const totalDelivered = edges.reduce((sum, e) => sum + e.rate, 0);
            const totalConsumed = consumed[itemId] || 0;
            if (totalDelivered > EPSILON && totalConsumed < totalDelivered) {
              const scale = totalConsumed / totalDelivered;
              for (const edge of edges) edge.rate *= scale;
            }
          }

          // Satisfaction = minimum input fulfillment ratio
          let minSat = 1.0;
          for (const inp of recipe.inputs) {
            const req = block.demand[inp.itemId] || 0;
            if (req > EPSILON) {
              const sat = (consumed[inp.itemId] || 0) / req;
              if (sat < minSat) minSat = sat;
            }
          }
          block.satisfaction = minSat;
        }

        // OUTPUT: (Requested * Satisfaction) CLAMPED by Physical Machine Capacity
        for (const itemId of Object.keys(node.requested || {})) {
          const requestedValue = node.requested![itemId] || 0;
          const goal = requestedValue * block.satisfaction;
          const cap = blockCapacities[itemId] ?? Infinity;
          block.output[itemId] = Math.min(goal, cap);
        }
        supplyToGive = block.output;
      } else {
        // Stationary Node (Sink/Storage)
        block.supply = aggregateEdges(idx.incomingAll, "rate");
        block.output = { ...block.supply };
        supplyToGive = block.output;

        // Satisfaction = Fulfillment ratio
        let minSat = 1.0;
        for (const itemId of Object.keys(block.demand)) {
          const req = block.demand[itemId] || 0;
          if (req > EPSILON) {
            const sat = (block.supply[itemId] || 0) / req;
            if (sat < minSat) minSat = sat;
          }
        }
        block.satisfaction = minSat;
      }
    } else if (node.type === "logistics") {
      // Logistics nodes provide what their inputs supplied
      node.supply = aggregateEdges(idx.incomingAll, "rate");
      node.output = { ...node.supply };
      supplyToGive = node.output;

      // Satisfaction = Fulfillment ratio
      let totalReq = 0;
      let totalOut = 0;
      for (const itemId of Object.keys(node.requested || {})) {
        totalReq += node.requested![itemId] || 0;
        totalOut += node.output[itemId] || 0;
      }
      node.satisfaction = totalReq > EPSILON ? totalOut / totalReq : 1.0;
    }

    // Distribute supply to outgoing edges: Standard Splitter Logic (Even Split)
    for (const [itemId, edges] of idx.outgoing.entries()) {
      let available = supplyToGive[itemId] || 0;
      if (available <= EPSILON) {
        for (const edge of edges) edge.rate = 0;
        continue;
      }

      // Calculate the maximum each edge wants/can take.
      // We respect edge.demand if it exists, otherwise assume infinite room (overflow).
      const edgeLimits = edges.map((edge) => {
        return edge.demand > EPSILON ? edge.demand : Infinity;
      });

      // Iterative distribution to handle caps (water-filling algorithm)
      // We want to give everyone an equal share of the 'remaining' supply,
      // but capped by their individual limit.
      let remainingEdges = edges.map((_, i) => i);
      let distribution = new Array(edges.length).fill(0);

      while (remainingEdges.length > 0 && available > EPSILON) {
        const share = available / remainingEdges.length;
        let nextRemaining: number[] = [];
        let gaveSomething = false;

        for (const i of remainingEdges) {
          const alreadyGiven = distribution[i];
          const cap = edgeLimits[i];
          const canTake = cap - alreadyGiven;

          if (canTake <= EPSILON) {
            // This edge is full
            continue;
          }

          const give = Math.min(share, canTake);
          distribution[i] += give;
          available -= give;

          if (distribution[i] < cap - EPSILON) {
            // Still has room, keep in pool
            nextRemaining.push(i);
          }
          gaveSomething = true;
        }

        if (!gaveSomething) break; // Everyone full or no supply left
        remainingEdges = nextRemaining;
      }

      // Assign final rates
      for (let i = 0; i < edges.length; i++) {
        edges[i].rate = distribution[i];
      }
    }
  }
}

// ── Convergence Check ───────────────────────────────────────────────

function isConverged(
  edges: Connection[],
  prevDemand: Map<string, number>,
  prevRate: Map<string, number>
): boolean {
  for (const edge of edges) {
    const pd = prevDemand.get(edge.id) || 0;
    const pr = prevRate.get(edge.id) || 0;

    if (relDiff(edge.demand, pd) > CONVERGENCE_TOLERANCE) return false;
    if (relDiff(edge.rate, pr) > CONVERGENCE_TOLERANCE) return false;
  }
  return true;
}

function relDiff(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max < EPSILON) return 0;
  return Math.abs(a - b) / max;
}

// ── Helpers ─────────────────────────────────────────────────────────

function aggregateEdges(
  edges: Connection[],
  field: "demand" | "rate"
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const edge of edges) {
    result[edge.itemId] = (result[edge.itemId] || 0) + edge[field];
  }
  return result;
}

function getEffectiveTime(
  recipe: Recipe,
  machines: Record<string, Machine> | undefined
): number {
  const speed = machines?.[recipe.machineId]?.speed ?? 1.0;
  if (!Number.isFinite(speed) || speed <= 0) return NaN;
  return recipe.craftingTime / speed;
}

function getBlockCapacities(
  block: ProductionBlock,
  recipe: Recipe,
  machines: Record<string, Machine> | undefined
): Record<string, number> {
  const capacities: Record<string, number> = {};
  const effectiveTime = getEffectiveTime(recipe, machines);
  if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON)
    return capacities;

  const count = block.machineCount ?? 1;
  const isGatherer = recipe.category === "Gathering";
  const yieldMult = block.sourceYield ?? 1.0;

  // Manual Mode Law:
  // For Miners: Rate = Base * Veins (Ignore machine count multiplication)
  // For Others: Rate = Base * MachineCount
  const multiplier = isGatherer ? yieldMult : count;

  for (const inp of recipe.inputs) {
    capacities[inp.itemId] = (inp.amount / effectiveTime) * count;
  }
  for (const out of recipe.outputs) {
    capacities[out.itemId] = (out.amount / effectiveTime) * multiplier;
  }
  return capacities;
}
