import { Edge } from 'reactflow';
import { BeltEdgeData, BlockNode, Port, Block, SplitterNodeData } from '@/types/block';
import { GameDefinition } from '@/types/game';
import { findNodeConflicts } from '@/lib/validation/conflictDetection';
import { getDownstreamDemand, getTargetDemand } from '@/lib/solver/flowDemand';
import { getPort, updateEdgeStatus } from '@/lib/layout/edgeStatus';
import { solveAllRoutes } from '@/lib/router/routeSolver';
import { calculateNodeSize } from '@/lib/layout/calculateNodeSize';

interface FlowSolveState {
    nodes: BlockNode[];
    edges: Edge[];
    nodeConflicts: Set<string>;
}

interface FlowSolveOptions {
    skipRateSolver?: boolean;
    skipRouting?: boolean;
    onlyRouteNodeId?: string;
    flowMode?: boolean;
}

export const recalculateLayoutFlows = (
    state: FlowSolveState,
    game: GameDefinition,
    options?: FlowSolveOptions
) => {
    // 0. Update node sizes based on current mode and data
    state.nodes.forEach(node => {
        const newSize = calculateNodeSize(node, !!options?.flowMode, game);
        // Only update if dimensions actually changed to prevent re-render churn
        if (!node.data.size ||
            node.data.size.width !== newSize.width ||
            node.data.size.height !== newSize.height) {
            node.data.size = newSize;
        }
    });

    state.nodeConflicts = findNodeConflicts(state.nodes);

    if (!options?.skipRateSolver) {
        state.nodes.forEach((node) => {
            const data = node.data as Block | SplitterNodeData;
            if ('outputPorts' in data) {
                data.outputPorts.forEach((port: Port) => {
                    port.currentRate = (node.type === 'splitter' ? 0 : port.rate);
                });
            }
            if ('inputPorts' in data) {
                data.inputPorts.forEach((port: Port) => {
                    port.currentRate = undefined;
                });
            }
        });

        const ITERATIONS = 15;
        const connectedInputs = new Set(state.edges.map((edge) => `${edge.target}-${edge.targetHandle}`));

        for (let i = 0; i < ITERATIONS; i++) {
            let changed = false;

            // --- BACKWARD PASS: Propagation of Demand (Requests) ---
            // This propagates "Wants" from sinks to sources.
            state.nodes.forEach((node) => {
                const data = node.data as Block | SplitterNodeData;
                if (node.type === 'block') {
                    // Blocks define demand on their inputs based on their target rate.
                    data.inputPorts.forEach(port => {
                        port.targetDemand = port.rate;
                    });
                    // Output ports' demand is what the next thing wants.
                    data.outputPorts.forEach(port => {
                        port.targetDemand = getDownstreamDemand(node.id, port.id, state.nodes, state.edges);
                    });
                } else if (node.type === 'splitter') {
                    // Splitters sum downstream demand and propagate it to inputs.
                    const totalOutDemand = data.outputPorts.reduce((sum, p) =>
                        sum + getDownstreamDemand(node.id, p.id, state.nodes, state.edges), 0
                    );
                    data.outputPorts.forEach(port => {
                        port.targetDemand = getDownstreamDemand(node.id, port.id, state.nodes, state.edges);
                    });
                    data.inputPorts.forEach(port => {
                        // Spread demand across inputs (simple split for now)
                        port.targetDemand = totalOutDemand / Math.max(1, data.inputPorts.length);
                    });
                }
            });

            // --- FORWARD PASS: Propagation of Supply (Haves) ---
            const inputFlows = new Map<string, number>();
            const edgesBySource = new Map<string, Edge[]>();
            state.edges.forEach((edge) => {
                const key = `${edge.source}-${edge.sourceHandle}`;
                const group = edgesBySource.get(key) || [];
                group.push(edge);
                edgesBySource.set(key, group);
            });

            edgesBySource.forEach((group) => {
                const firstEdge = group[0];
                const sourceNode = state.nodes.find((node) => node.id === firstEdge.source);
                if (!sourceNode) return;
                const sourcePort = getPort(sourceNode, firstEdge.sourceHandle ?? null, 'output');
                if (!sourcePort) return;

                const totalAvailable = sourcePort.currentRate ?? 0;
                if (group.length === 1) {
                    const targetKey = `${firstEdge.target}-${firstEdge.targetHandle}`;
                    inputFlows.set(targetKey, (inputFlows.get(targetKey) || 0) + totalAvailable);
                } else {
                    const demands = group.map((edge) => getTargetDemand(edge.target, edge.targetHandle!, state.nodes, state.edges));
                    const totalDemand = demands.reduce((sum, value) => sum + value, 0);
                    group.forEach((edge, index) => {
                        const share = totalDemand > 0 ? (demands[index] / totalDemand) : (1 / group.length);
                        const flow = totalAvailable * share;
                        const targetKey = `${edge.target}-${edge.targetHandle}`;
                        inputFlows.set(targetKey, (inputFlows.get(targetKey) || 0) + flow);
                    });
                }
            });

            state.nodes.forEach((node) => {
                const data = node.data as unknown;

                if (node.type === 'block') {
                    const blockData = data as Block;
                    let satisfaction = 1.0;
                    if (blockData.inputPorts.length > 0) {
                        const satisfactions = blockData.inputPorts.map((port: Port) => {
                            if (port.rate <= 0) return 1.0;
                            const key = `${node.id}-${port.id}`;
                            const incoming = inputFlows.get(key) || 0;

                            // SYNC POINT: Write back the reality to the input port
                            if (Math.abs((port.currentRate ?? 0) - incoming) > 0.001) {
                                port.currentRate = incoming;
                                changed = true;
                            }

                            if (!connectedInputs.has(key)) return 1.0;
                            return Math.min(1.0, incoming / port.rate);
                        });
                        satisfaction = Math.min(...satisfactions);
                    }
                    blockData.outputPorts.forEach((port: Port) => {
                        const newRate = port.rate * satisfaction;
                        if (Math.abs((port.currentRate ?? 0) - newRate) > 0.001) {
                            port.currentRate = newRate;
                            changed = true;
                        }
                    });
                } else if (node.type === 'splitter') {
                    const splitterData = data as SplitterNodeData;
                    const totalIn = splitterData.inputPorts.reduce((sum: number, port: Port) => sum + (inputFlows.get(`${node.id}-${port.id}`) || 0), 0);
                    const outputs = splitterData.outputPorts as Port[];
                    if (outputs.length === 0) return;

                    const demands = outputs.map((port: Port) => getDownstreamDemand(node.id, port.id, state.nodes, state.edges));
                    const totalDemand = demands.reduce((sum, value) => sum + value, 0);

                    const incomingEdges = state.edges.filter((edge) => edge.target === node.id);
                    const incomingItem = incomingEdges.map((edge) => {
                        const sourceNode = state.nodes.find((nodeItem) => nodeItem.id === edge.source);
                        if (!sourceNode) return null;
                        return getPort(sourceNode, edge.sourceHandle ?? null, 'output');
                    }).find((port) => port && port.itemId !== 'any')?.itemId || 'any';

                    if (splitterData.inputPorts[0]?.itemId !== incomingItem) {
                        changed = true;
                        splitterData.inputPorts.forEach((port: Port) => { port.itemId = incomingItem; });
                        splitterData.outputPorts.forEach((port: Port) => { port.itemId = incomingItem; });
                    }

                    const connectedInputPorts = splitterData.inputPorts.filter((port: Port) => connectedInputs.has(`${node.id}-${port.id}`));
                    const totalCurrentSupply = connectedInputPorts.reduce((sum: number, port: Port) => sum + (inputFlows.get(`${node.id}-${port.id}`) || 0), 0);

                    splitterData.inputPorts.forEach((port: Port) => {
                        const key = `${node.id}-${port.id}`;
                        if (!connectedInputs.has(key)) {
                            port.rate = 0;
                            return;
                        }

                        const mySupply = inputFlows.get(key) || 0;
                        if (totalCurrentSupply >= totalDemand) {
                            port.rate = mySupply;
                        } else if (totalCurrentSupply === 0) {
                            port.rate = totalDemand / connectedInputPorts.length;
                        } else {
                            port.rate = (mySupply / totalCurrentSupply) * totalDemand;
                        }
                    });

                    let newRates: number[] = [];

                    if (totalDemand === 0) {
                        const share = outputs.length > 0 ? totalIn / outputs.length : 0;
                        newRates = outputs.map(() => share);
                    } else if (splitterData.priority === 'balanced' || !splitterData.priority) {
                        if (totalDemand > 0) {
                            newRates = demands.map((demand) => (demand / totalDemand) * totalIn);
                        } else {
                            const share = totalIn / outputs.length;
                            newRates = outputs.map(() => share);
                        }
                    } else if (splitterData.priority === 'out-left' || splitterData.priority === 'out-right') {
                        const prioIdx = splitterData.priority === 'out-left' ? 0 : 1;
                        const otherIdx = prioIdx === 0 ? 1 : 0;

                        const prioTake = Math.min(totalIn, demands[prioIdx]);
                        newRates = [];
                        newRates[prioIdx] = prioTake;

                        const remaining = totalIn - prioTake;
                        newRates[otherIdx] = remaining;

                        if (totalIn > 0 && totalDemand === 0) {
                            newRates[prioIdx] = totalIn;
                            newRates[otherIdx] = 0;
                        }
                    } else {
                        const share = totalIn / outputs.length;
                        newRates = outputs.map(() => share);
                    }

                    outputs.forEach((port: Port, index: number) => {
                        const newRate = newRates[index] || 0;
                        const demand = demands[index] || 0;

                        port.rate = demand;

                        if (Math.abs((port.currentRate ?? 0) - newRate) > 0.001) {
                            port.currentRate = newRate;
                            changed = true;
                        }
                    });
                }
            });

            if (!changed) break;
        }
    }

    const edgeFlows = new Map<string, number>();
    const edgeDemands = new Map<string, number>();

    const edgesBySourceGroup = new Map<string, Edge[]>();
    state.edges.forEach((edge) => {
        const key = `${edge.source}-${edge.sourceHandle}`;
        const group = edgesBySourceGroup.get(key) || [];
        group.push(edge);
        edgesBySourceGroup.set(key, group);
    });

    edgesBySourceGroup.forEach((group) => {
        const firstEdge = group[0];
        const sourceNode = state.nodes.find((node) => node.id === firstEdge.source);
        if (!sourceNode) return;
        const sourcePort = getPort(sourceNode, firstEdge.sourceHandle ?? null, 'output');
        if (!sourcePort) return;

        const totalAvailable = sourcePort.currentRate ?? 0;
        const demands = group.map((edge) => getTargetDemand(edge.target, edge.targetHandle!, state.nodes, state.edges));
        const totalDemand = demands.reduce((sum, value) => sum + value, 0);

        // Saturation ratio: If we have enough supply (Available >= Demand), everyone gets 100% of demand.
        // If not, everyone gets a proportional share (Available / Demand).
        const saturation = totalDemand > 0 ? Math.min(1.0, totalAvailable / totalDemand) : 0;

        group.forEach((edge, index) => {
            const requested = demands[index];
            // If demand is 0 but we have supply, we might want to distribute evenly? 
            // For now, respect demand. If no demand, no flow.
            const flow = requested * saturation;

            edgeFlows.set(edge.id, flow);
            edgeDemands.set(edge.id, requested);
        });
    });

    state.edges = state.edges.map((edge) => {
        const flow = edgeFlows.get(edge.id);
        const demand = edgeDemands.get(edge.id);
        return updateEdgeStatus(edge, state.nodes, game, flow, demand, Boolean(options?.flowMode));
    });

    // Solve paths for all edges (only if not skipped)
    if (!options?.skipRouting) {
        state.edges = solveAllRoutes(state.nodes, state.edges, game, options?.onlyRouteNodeId, options?.flowMode);
    }
};

export const updateEdgeBeltTier = (
    edge: Edge,
    nodes: BlockNode[],
    game: GameDefinition
): Edge => {
    if (!edge.data) return edge;
    const beltData = { ...(edge.data as BeltEdgeData) };
    const belts = game.belts;
    const currentIndex = belts.findIndex((beltTier) => beltTier.id === beltData.beltId);
    const nextBelt = belts[(currentIndex + 1) % belts.length];
    beltData.beltId = nextBelt.id;
    const updated = updateEdgeStatus({ ...edge, data: beltData }, nodes, game, undefined, undefined, false);
    return { ...edge, data: updated.data };
};
