/**
 * ROLE: The Intelligence (Logical Flow Layer)
 * PURPOSE: Propagates demand backwards and supply forwards via interleaved
 *          convergence loop. Handles cyclic graphs (oil loops, proliferator feedback).
 * INPUT: FlowGraph (nodes/edges), Recipe Dictionary, optional Machine Dictionary
 * OUTPUT: Updated FlowGraph with resolved demand, rate, and satisfaction values.
 */

import { FactoryLayout, Connection, ProductionBlock } from '../factory/core/factory.types';
import { Recipe, Machine } from '../gamedata/gamedata.types';

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

    finalizeResults(graph, recipes, machines);
    return graph;
}

// ── Initialization ──────────────────────────────────────────────────

function initializeGraph(graph: FactoryLayout): void {
    for (const node of Object.values(graph.blocks)) {
        node.supply = {};
        node.output = {};
        node.results = { flows: {}, satisfaction: 1.0 };
        if (node.type === 'block' || node.type === 'logistics') {
            node.demand = {};
            node.satisfaction = 1.0;
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
    machines?: Record<string, Machine>
): void {
    for (const node of Object.values(graph.blocks)) {
        const flows: Record<string, { actual: number, demand: number, capacity: number }> = {};
        const itemIds = new Set<string>([
            ...Object.keys(node.demand),
            ...Object.keys(node.supply),
            ...Object.keys(node.output),
            ...Object.keys(node.requested || {})
        ]);

        const capacities: Record<string, number> = {};
        if (node.type === 'block') {
            const block = node as ProductionBlock;
            if (block.recipeId) {
                const recipe = recipes[block.recipeId];
                if (recipe) {
                    const effectiveTime = getEffectiveTime(recipe, machines);
                    if (Number.isFinite(effectiveTime) && effectiveTime > 0) {
                        const count = block.machineCount ?? 1;
                        const yieldMult = recipe.category === 'Gathering' ? (block.sourceYield ?? 1.0) : 1.0;
                        for (const out of recipe.outputs) {
                            capacities[out.itemId] = (out.amount / effectiveTime) * count * yieldMult;
                        }
                        for (const inp of recipe.inputs) {
                            capacities[inp.itemId] = (inp.amount / effectiveTime) * count;
                        }
                    }
                }
            }
        } else if (node.type === 'sink') {
            for (const id of Object.keys(node.demand)) {
                capacities[id] = node.demand[id];
            }
        } else if (node.type === 'logistics') {
            for (const id of Object.keys(node.demand)) {
                capacities[id] = node.demand[id];
            }
        }

        for (const id of itemIds) {
            const isOutput = node.output?.[id] !== undefined || (node.requested && node.requested[id] !== undefined);
            flows[id] = {
                demand: isOutput ? (node.requested?.[id] || 0) : (node.demand[id] || 0),
                actual: isOutput ? (node.output?.[id] || 0) : (node.supply?.[id] || 0),
                capacity: capacities[id] || 0
            };
        }

        node.results = {
            flows,
            satisfaction: node.satisfaction
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

        if (node.type === 'block') {
            const block = node as ProductionBlock;
            if (!block.recipeId) continue;
            const recipe = recipes[block.recipeId];
            if (!recipe) continue;

            // 1. Calculate goals for each recipe output
            const outputGoals: Record<string, number> = {};
            const effectiveTime = getEffectiveTime(recipe, machines);

            for (const out of recipe.outputs) {
                const itemId = out.itemId;
                const edgesForItem = idx.outgoingAll.filter(e => e.itemId === itemId);

                if (edgesForItem.length > 0) {
                    // A. Connected: Demand is the sum of what's requested downstream
                    outputGoals[itemId] = edgesForItem.reduce((sum, e) => sum + e.demand, 0);
                } else {
                    // B. Unconnected: Treat as Implicit Sink (Requested = Capacity)
                    const count = block.machineCount !== undefined ? block.machineCount : 1.0;
                    const yieldMult = recipe.category === 'Gathering' ? (block.sourceYield ?? 1.0) : 1.0;
                    outputGoals[itemId] = (out.amount / effectiveTime) * yieldMult * count;
                }
            }

            // Allow manual user overrides to take precedence if they are higher
            const manualGoals = node.requested || {};
            for (const itemId of Object.keys(manualGoals)) {
                outputGoals[itemId] = Math.max(outputGoals[itemId] || 0, manualGoals[itemId]);
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
            const yieldMult = recipe.category === 'Gathering' ? (node.sourceYield ?? 1.0) : 1.0;

            for (const out of recipe.outputs) {
                const goal = outputGoals[out.itemId] || 0;
                const ratePerMachine = (out.amount / effectiveTime) * yieldMult;
                if (ratePerMachine > EPSILON) {
                    const scale = goal / ratePerMachine;
                    if (scale > maxScale) maxScale = scale;
                }
            }

            // 3. Set input demands from recipe ratios
            block.demand = {};
            for (const inp of recipe.inputs) {
                const ratePerUnit = inp.amount / effectiveTime;
                block.demand[inp.itemId] = maxScale * ratePerUnit;
            }
        } else if (node.type === 'logistics') {
            // Logistics nodes 'requested' goal is what their outputs want
            const goals = aggregateEdges(idx.outgoingAll, 'demand');
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
    const weights = edges.map(e => Math.max(e.rate, 0));
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

        if (node.type === 'block') {
            const block = node as ProductionBlock;

            // Check if this is a source block (no incoming edges with sourceYield)
            const isSource = idx.incomingAll.length === 0 && block.sourceYield !== undefined;

            if (isSource) {
                // Source block: produces up to sourceYield capacity, limited by demand
                block.satisfaction = 1.0;
                // Output the min of demand and sourceYield for each output item
                const outgoingDemand = aggregateEdges(idx.outgoingAll, 'demand');
                for (const itemId of Object.keys(outgoingDemand)) {
                    block.output[itemId] = Math.min(outgoingDemand[itemId], block.sourceYield!);
                }
                supplyToGive = block.output;
            } else {
                // Regular production block
                if (!block.recipeId) continue;
                const recipe = recipes[block.recipeId];
                if (!recipe) continue;

                const effectiveTime = getEffectiveTime(recipe, machines);
                if (!Number.isFinite(effectiveTime) || effectiveTime <= EPSILON) {
                    block.satisfaction = 0;
                    block.output = {};
                    supplyToGive = block.output;
                    continue;
                }

                // Satisfaction = minimum input fulfillment ratio
                const delivered = aggregateEdges(idx.incomingAll, 'rate');
                block.supply = delivered;
                let minSat = 1.0;
                for (const inp of recipe.inputs) {
                    const req = block.demand[inp.itemId] || 0;
                    if (req > EPSILON) {
                        const sat = (delivered[inp.itemId] || 0) / req;
                        if (sat < minSat) minSat = sat;
                    }
                }
                block.satisfaction = minSat;

                // Output = requested * satisfaction
                for (const itemId of Object.keys(node.requested || {})) {
                    block.output[itemId] = (node.requested![itemId] || 0) * block.satisfaction;
                }
                supplyToGive = block.output;
            }

        } else if (node.type === 'logistics') {
            // Logistics nodes provide what their inputs supplied
            node.supply = aggregateEdges(idx.incomingAll, 'rate');
            node.output = { ...node.supply };
            supplyToGive = node.output;
            node.satisfaction = 1.0;
        } else if (node.type === 'sink') {
            node.supply = aggregateEdges(idx.incomingAll, 'rate');
            // Satisfaction = how much of the sink's demand is being met
            let minSat = 1.0;
            for (const itemId of Object.keys(node.demand)) {
                const req = node.demand[itemId] || 0;
                if (req > EPSILON) {
                    const sat = (node.supply[itemId] || 0) / req;
                    if (sat < minSat) minSat = sat;
                }
            }
            node.satisfaction = minSat;
            continue; // sinks have no outgoing edges
        }

        // Distribute supply to outgoing edges proportionally by demand
        for (const [itemId, edges] of idx.outgoing) {
            const available = supplyToGive[itemId] || 0;
            const totalDemand = edges.reduce((s, e) => s + e.demand, 0);

            if (totalDemand > EPSILON) {
                for (const edge of edges) {
                    edge.rate = available * (edge.demand / totalDemand);
                }
            } else {
                const share = available / edges.length;
                for (const edge of edges) {
                    edge.rate = share;
                }
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
    field: 'demand' | 'rate'
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
