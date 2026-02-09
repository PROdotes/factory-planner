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
  GathererBlock,
  FlowResult,
} from "../factory/core/factory.types";
import { Recipe, Machine, Gatherer } from "../gamedata/gamedata.types";

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
  machines?: Record<string, Machine>,
  gatherers?: Record<string, Gatherer>
): FactoryLayout {
  if (Object.keys(graph.blocks).length === 0) return graph;

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

    backwardPass(graph, recipes, machines, gatherers, index, order);
    forwardPass(graph, recipes, machines, gatherers, index, order);
    if (isConverged(graph.connections, prevDemand, prevRate)) break;
  }

  finalizeResults(graph, recipes, machines, gatherers, index);
  return graph;
}

// ── Initialization ──────────────────────────────────────────────────

function initializeGraph(graph: FactoryLayout): void {
  for (const node of Object.values(graph.blocks)) {
    // Snapshot manual intent before clearing derivation fields
    (node as any)._manualDemand = { ...(node.demand || {}) };
    (node as any)._manualRequested = { ...(node.requested || {}) };

    node.supply = {};
    node.output = {};
    node.satisfaction = 1.0;

    // Clear hidden delivery metadata
    if ((node as any)._delivered) delete (node as any)._delivered;

    node.results = { flows: {}, satisfaction: 1.0 };

    // DERIVED DEMAND: We preserve user-defined 'demand' values on Sinks.
    // They will be combined with downstream goals in the backward pass.
    if (node.type === "logistics") {
      // No clearing here
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
  gatherers: Record<string, Gatherer> | undefined,
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
        for (const inp of recipe.inputs) itemIds.add(inp.itemId);
        for (const out of recipe.outputs) itemIds.add(out.itemId);

        const blockCapacities = getBlockCapacities(
          block,
          recipe,
          machines,
          false
        );
        Object.assign(capacities, blockCapacities);
      } else if (node.demand) {
        for (const id of Object.keys(node.demand)) {
          capacities[id] = node.demand[id];
        }
      }
    } else if (node.type === "gatherer") {
      const block = node as GathererBlock;
      const gatherer = block.gathererId ? gatherers?.[block.gathererId] : null;

      if (gatherer) {
        itemIds.add(gatherer.outputItemId);
        const cap = getGathererCapacity(block, gatherer, machines);
        capacities[gatherer.outputItemId] = cap;
      }
    } else if (node.type === "logistics") {
      if (node.demand) {
        for (const id of Object.keys(node.demand)) {
          capacities[id] = node.demand[id];
        }
      }
    }

    const delivered = (node as any)._delivered || {};

    for (const id of itemIds) {
      const isOutput =
        node.output?.[id] !== undefined ||
        (node.requested && node.requested[id] !== undefined);

      const actualValue = isOutput
        ? node.output?.[id] || 0
        : node.supply?.[id] || 0;

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

function computeProcessingOrder(
  graph: FactoryLayout,
  index: Map<string, NodeIndex>
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) return;
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

  for (const id of Object.keys(graph.blocks)) {
    const idx = index.get(id);
    if (idx && idx.incomingAll.length === 0) visit(id);
  }
  for (const id of Object.keys(graph.blocks)) {
    visit(id);
  }

  order.reverse();
  return order;
}

function backwardPass(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine> | undefined,
  gatherers: Record<string, Gatherer> | undefined,
  index: Map<string, NodeIndex>,
  order: string[]
): void {
  for (let i = order.length - 1; i >= 0; i--) {
    const node = graph.blocks[order[i]];
    if (!node) continue;
    const idx = index.get(node.id)!;

    if (node.type === "production") {
      const block = node as ProductionBlock;
      const recipe = block.recipeId ? recipes[block.recipeId] : null;

      if (recipe) {
        const isSourceNode = recipe.inputs.length === 0;
        const outputGoals: Record<string, number> = {};
        const activeMachineId = block.machineId || recipe.machineId;
        const effectiveTime = getEffectiveTime(
          recipe,
          machines,
          activeMachineId
        );

        for (const out of recipe.outputs) {
          const itemId = out.itemId;
          const edgesForItem = idx.outgoingAll.filter(
            (e) => e.itemId === itemId
          );
          const downstreamGoal = edgesForItem.reduce(
            (sum, e) => sum + e.demand,
            0
          );

          // SINK DEPENDENCY: If there is any downstream demand, it is the ONLY demand.
          // Otherwise, if the block is terminal (unconnected), we use the manual request.
          let goal = downstreamGoal;
          const hasOutgoingConnections = downstreamGoal > EPSILON;

          if (!hasOutgoingConnections) {
            goal = (node as any)._manualRequested?.[itemId] || 0;
          }

          // Fallback for Source Nodes (miners/magic sources) to show capacity if disconnected.
          if (isSourceNode && goal < EPSILON) {
            const count = block.machineCount ?? 1.0;
            goal = (out.amount / effectiveTime) * count;
          }

          outputGoals[itemId] = goal;
        }

        node.requested = outputGoals;
        if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON) {
          block.demand = {};
          for (const inp of recipe.inputs) block.demand[inp.itemId] = 0;
          continue;
        }

        let maxScale = 0;
        if (recipe.outputs.length > 0) {
          for (const out of recipe.outputs) {
            const goal = outputGoals[out.itemId] || 0;
            const ratePerMachine = out.amount / effectiveTime;
            if (ratePerMachine > EPSILON) {
              const scale = goal / ratePerMachine;
              if (scale > maxScale) maxScale = scale;
            }
          }
        } else {
          let highestInputScale = 0;
          for (const inp of recipe.inputs) {
            const targetRate =
              (node as any)._manualRequested?.[inp.itemId] || 0;
            const ratePerMachine = inp.amount / effectiveTime;
            if (ratePerMachine > EPSILON) {
              highestInputScale = Math.max(
                highestInputScale,
                targetRate / ratePerMachine
              );
            }
          }
          if (highestInputScale === 0) {
            highestInputScale = (
              Object.values((node as any)._manualRequested || {}) as number[]
            ).reduce((a, b) => Math.max(a, b), 0);
          }
          maxScale = highestInputScale;
        }

        block.demand = {};
        for (const inp of recipe.inputs) {
          const ratePerUnit = inp.amount / effectiveTime;
          block.demand[inp.itemId] = maxScale * ratePerUnit;
        }
        (block as any)._demandScale = maxScale;
      } else if (block.recipeId) {
        // Production block with a missing or invalid recipeId.
        // It produces nothing and demands nothing.
        node.requested = {};
        node.demand = {};
      } else {
        // Stationary Node (Sink/Storage) - no recipeId.
        const outgoingDemand = aggregateEdges(idx.outgoingAll, "demand");
        const manualDemand = (node as any)._manualDemand || {}; // Use snapshot of user intent
        const finalDemand: Record<string, number> = { ...outgoingDemand };
        for (const [id, val] of Object.entries(manualDemand)) {
          finalDemand[id] = Math.max(finalDemand[id] || 0, val as number);
        }
        node.requested = finalDemand;
        node.demand = finalDemand;
      }
    } else if (node.type === "gatherer") {
      const block = node as GathererBlock;
      const gatherer = block.gathererId ? gatherers?.[block.gathererId] : null;

      if (gatherer) {
        const itemId = gatherer.outputItemId;
        const edgesForItem = idx.outgoingAll.filter((e) => e.itemId === itemId);
        let outputGoal: number;
        if (edgesForItem.length > 0) {
          outputGoal = edgesForItem.reduce(
            (sum: number, e: Connection) => sum + e.demand,
            0
          );
        } else {
          outputGoal = getGathererCapacity(block, gatherer, machines);
        }
        node.requested = { [itemId]: outputGoal };
        block.demand = {};
      } else {
        node.requested = { ...node.demand };
      }
    } else if (node.type === "logistics") {
      const outgoingGoal = aggregateEdges(idx.outgoingAll, "demand");
      const manualGoal = (node as any)._manualDemand || {};
      const finalGoal: Record<string, number> = { ...outgoingGoal };
      for (const [id, val] of Object.entries(manualGoal)) {
        finalGoal[id] = Math.max(finalGoal[id] || 0, val as number);
      }
      node.requested = finalGoal;
      node.demand = finalGoal;
    }

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

  const weights = edges.map((e) => Math.max(e.rate, 0));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  if (totalWeight > EPSILON) {
    for (let i = 0; i < edges.length; i++) {
      edges[i].demand = totalDemand * (weights[i] / totalWeight);
    }
  } else {
    const share = totalDemand / edges.length;
    for (const edge of edges) edge.demand = share;
  }
}

function forwardPass(
  graph: FactoryLayout,
  recipes: Record<string, Recipe>,
  machines: Record<string, Machine> | undefined,
  gatherers: Record<string, Gatherer> | undefined,
  index: Map<string, NodeIndex>,
  order: string[]
): void {
  for (const nodeId of order) {
    const node = graph.blocks[nodeId];
    if (!node) continue;
    const idx = index.get(nodeId)!;

    let supplyToGive: Record<string, number> = {};

    if (node.type === "production") {
      const block = node as ProductionBlock;
      const recipe = block.recipeId ? recipes[block.recipeId] : null;

      if (
        !recipe &&
        block.sourceYield !== undefined &&
        idx.incomingAll.length === 0
      ) {
        block.satisfaction = 1.0;
        const outgoingDemand = aggregateEdges(idx.outgoingAll, "demand");
        for (const itemId of Object.keys(outgoingDemand)) {
          block.output[itemId] = Math.min(
            outgoingDemand[itemId],
            block.sourceYield!
          );
        }
        supplyToGive = block.output;
      } else if (recipe) {
        const activeMachineId = block.machineId || recipe.machineId;
        const effectiveTime = getEffectiveTime(
          recipe,
          machines,
          activeMachineId
        );
        if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON) {
          block.satisfaction = 0;
          block.output = {};
          supplyToGive = block.output;
          continue;
        }

        const blockCapacities = getBlockCapacities(
          block,
          recipe,
          machines,
          false
        );
        const delivered = aggregateEdges(idx.incomingAll, "rate");

        if (recipe.inputs.length === 0) {
          block.satisfaction = 1.0;
          block.supply = {};
        } else {
          const consumed: Record<string, number> = {};
          for (const inp of recipe.inputs) {
            const cap = blockCapacities[inp.itemId] ?? Infinity;
            consumed[inp.itemId] = Math.min(delivered[inp.itemId] || 0, cap);
          }
          block.supply = consumed;
          (block as any)._delivered = delivered;

          for (const [itemId, edges] of idx.incoming) {
            const totalDelivered = edges.reduce((sum, e) => sum + e.rate, 0);
            const totalConsumed = consumed[itemId] || 0;
            if (totalDelivered > EPSILON && totalConsumed < totalDelivered) {
              const scale = totalConsumed / totalDelivered;
              for (const edge of edges) edge.rate *= scale;
            }
          }

          // Satisfaction is determined by input availability
          let inputSat = 1.0;
          for (const inp of recipe.inputs) {
            const req = block.demand[inp.itemId] || 0;
            if (req > EPSILON) {
              const sat = (consumed[inp.itemId] || 0) / req;
              if (sat < inputSat) inputSat = sat;
            }
          }
          block.satisfaction = inputSat;
        }

        // 3. Output Generation (Unified Scale Approach)
        const demandScale = (block as any)._demandScale || 0;
        const potentialScale = demandScale * block.satisfaction;
        const capacityScale = block.machineCount ?? 1.0;
        const actualScale = Math.min(potentialScale, capacityScale);

        // UPDATE SATISFACTION: Reflect final output fulfillment (accounts for capacity caps)
        if (demandScale > EPSILON) {
          block.satisfaction = actualScale / demandScale;
        } else {
          block.satisfaction = 1.0;
        }

        block.output = {};
        for (const out of recipe.outputs) {
          const unitRate = out.amount / effectiveTime;
          block.output[out.itemId] = actualScale * unitRate;
        }

        supplyToGive = block.output;
      } else {
        // Production block with NO recipe (Sink or Broken block)
        block.supply = aggregateEdges(idx.incomingAll, "rate");

        if (!block.recipeId) {
          // Stationary Node (Sink/Storage) - acts as a pass-through
          block.output = { ...block.supply };
        } else {
          // Broken Production Block - produces nothing
          block.output = {};
        }

        supplyToGive = block.output;

        // Satisfaction = Fulfillment ratio vs its demand record
        let minSat = 1.0;
        let hasDemand = false;
        for (const itemId of Object.keys(block.demand)) {
          hasDemand = true;
          const req = block.demand[itemId] || 0;
          const sat = req > EPSILON ? (block.supply[itemId] || 0) / req : 1.0;
          if (sat < minSat) minSat = sat;
        }

        // If it was supposed to produce something but has no recipe,
        // it can't fulfill output goals.
        if (!hasDemand && Object.keys(node.requested || {}).length > 0) {
          minSat = 0;
        }

        block.satisfaction = minSat;
      }
    } else if (node.type === "gatherer") {
      const block = node as GathererBlock;
      const gatherer = block.gathererId ? gatherers?.[block.gathererId] : null;
      if (gatherer) {
        block.satisfaction = 1.0;
        const itemId = gatherer.outputItemId;
        const cap = getGathererCapacity(block, gatherer, machines);
        block.output[itemId] = Math.min(node.requested?.[itemId] || 0, cap);
        supplyToGive = block.output;
      } else {
        block.supply = aggregateEdges(idx.incomingAll, "rate");
        block.output = { ...block.supply };
        supplyToGive = block.output;
        block.satisfaction = 1.0;
      }
    } else if (node.type === "logistics") {
      node.supply = aggregateEdges(idx.incomingAll, "rate");
      node.output = { ...node.supply };
      supplyToGive = node.output;
      let totalReq = 0;
      let totalOut = 0;
      for (const itemId of Object.keys(node.requested || {})) {
        totalReq += node.requested![itemId] || 0;
        totalOut += node.output[itemId] || 0;
      }
      node.satisfaction = totalReq > EPSILON ? totalOut / totalReq : 1.0;
    }

    for (const [itemId, edges] of idx.outgoing.entries()) {
      let available = supplyToGive[itemId] || 0;
      if (available <= EPSILON) {
        for (const edge of edges) edge.rate = 0;
        continue;
      }

      const edgeLimits = edges.map((e) =>
        e.demand > EPSILON ? e.demand : Infinity
      );
      let remainingEdges = edges.map((_, i) => i);
      let distribution = new Array(edges.length).fill(0);

      while (remainingEdges.length > 0 && available > EPSILON) {
        const share = available / remainingEdges.length;
        let nextRemaining: number[] = [];
        let gaveSomething = false;
        for (const i of remainingEdges) {
          const cap = edgeLimits[i];
          const canTake = cap - distribution[i];
          if (canTake <= EPSILON) continue;
          const give = Math.min(share, canTake);
          distribution[i] += give;
          available -= give;
          if (distribution[i] < cap - EPSILON) nextRemaining.push(i);
          gaveSomething = true;
        }
        if (!gaveSomething) break;
        remainingEdges = nextRemaining;
      }
      for (let i = 0; i < edges.length; i++) edges[i].rate = distribution[i];
    }
  }
}

function isConverged(
  edges: Connection[],
  prevDemand: Map<string, number>,
  prevRate: Map<string, number>
): boolean {
  for (const edge of edges) {
    if (
      relDiff(edge.demand, prevDemand.get(edge.id) || 0) > CONVERGENCE_TOLERANCE
    )
      return false;
    if (relDiff(edge.rate, prevRate.get(edge.id) || 0) > CONVERGENCE_TOLERANCE)
      return false;
  }
  return true;
}

function relDiff(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b));
  return max < EPSILON ? 0 : Math.abs(a - b) / max;
}

function aggregateEdges(
  edges: Connection[],
  field: "demand" | "rate"
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const edge of edges)
    result[edge.itemId] = (result[edge.itemId] || 0) + edge[field];
  return result;
}

function getEffectiveTime(
  recipe: Recipe,
  machines: Record<string, Machine> | undefined,
  machineId: string
): number {
  const speed = machines?.[machineId]?.speed ?? 1.0;
  return speed > 0 ? recipe.craftingTime / speed : NaN;
}

function getBlockCapacities(
  block: ProductionBlock,
  recipe: Recipe,
  machines: Record<string, Machine> | undefined,
  _isGatherer: boolean = false
): Record<string, number> {
  const capacities: Record<string, number> = {};
  const activeMachineId = block.machineId || recipe.machineId;
  const effectiveTime = getEffectiveTime(recipe, machines, activeMachineId);
  if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON)
    return capacities;
  const count = block.machineCount ?? 1;
  for (const inp of recipe.inputs)
    capacities[inp.itemId] = (inp.amount / effectiveTime) * count;
  for (const out of recipe.outputs)
    capacities[out.itemId] = (out.amount / effectiveTime) * count;
  return capacities;
}

function getGathererCapacity(
  block: GathererBlock,
  gatherer: Gatherer,
  machines: Record<string, Machine> | undefined
): number {
  const machine = machines?.[gatherer.machineId];
  const speed = machine?.speed ?? 1.0;
  const yieldMult = block.sourceYield ?? 1.0;
  return gatherer.extractionRate * yieldMult * speed;
}
