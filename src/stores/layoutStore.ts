import { create } from 'zustand';
import { produce } from 'immer';
import {
    Connection,
    Edge,
    EdgeChange,
    NodeChange,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges
} from 'reactflow';
import { Block, Port, BeltEdgeData, EdgeStatus, SplitterNodeData, getPortPosition, BlockNode } from '@/types/block';
import { useGameStore } from './gameStore';
import { beltItemsPerMinute } from '@/types/game';
import { solveBlock } from '@/lib/solver/rateSolver';
import { calculateBlockDimensions } from '@/lib/layout/manifoldSolver';
import { findChannelConflicts, findNodeConflicts, getChannelSegments } from '@/lib/validation/conflictDetection';
import { getLaneCount, Point } from '@/lib/router/channelRouter';



export interface ActivePort {
    nodeId: string;
    portId: string;
    type: 'input' | 'output';
}

interface LayoutState {
    nodes: BlockNode[];
    edges: Edge[];
    activePort: ActivePort | null;
    nodeConflicts: Set<string>;

    // Actions
    addBlock: (recipeId: string, position: { x: number; y: number }) => string;
    addSplitter: (type: 'splitter' | 'merger' | 'balancer', position: { x: number; y: number }) => string;
    updateBlock: (id: string, updates: Partial<Block | SplitterNodeData>) => void;
    deleteBlock: (id: string) => void;
    deleteEdge: (id: string) => void;
    onPortClick: (nodeId: string, portId: string, type: 'input' | 'output') => void;
    setActivePort: (port: ActivePort | null) => void;

    // React Flow handlers
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    createAndConnect: (recipeId: string, position: { x: number; y: number }, sourcePort: ActivePort) => void;

    recalculateFlows: (options?: { skipRateSolver?: boolean }) => void;
    cycleEdgeBelt: (edgeId: string) => void;
    exportLayout: () => void;
    importLayout: (json: string) => void;
    saveToStorage: () => void;
    loadFromStorage: () => void;
    refreshGlobalRates: () => void;
}

const getPort = (node: BlockNode, handleId: string | null, type: 'input' | 'output'): Port | undefined => {
    if (!handleId) return undefined;
    const data = node.data as any;
    const ports = type === 'output' ? data.outputPorts : data.inputPorts;
    return ports?.find((p: Port) => p.id === handleId);
};

const applyBlockSolver = (block: Block, game: any) => {
    const recipe = game.recipes.find((r: any) => r.id === block.recipeId);
    const machine = game.machines.find((m: any) => m.id === block.machineId) || game.machines[0];

    if (recipe && machine) {
        let speedMult = block.speedModifier || 1.0;
        let prodBonus = 0.0;

        if (block.modifier) {
            if (block.modifier.type === 'speed') {
                if (block.modifier.level === 1) speedMult *= 1.25;
                if (block.modifier.level === 2) speedMult *= 1.50;
                if (block.modifier.level === 3) speedMult *= 2.00;
            } else if (block.modifier.type === 'productivity') {
                if (block.modifier.level === 1) prodBonus = 0.125;
                if (block.modifier.level === 2) prodBonus = 0.20;
                if (block.modifier.level === 3) prodBonus = 0.25;
            }
        }

        const solved = solveBlock(recipe, machine, block.targetRate, speedMult, block.primaryOutputId, prodBonus);
        block.machineCount = solved.machineCount;
        block.actualRate = solved.actualRate;

        block.inputPorts.forEach((port) => {
            const solvedRate = solved.inputRates.find(ir => ir.itemId === port.itemId);
            if (solvedRate) port.rate = solvedRate.rate;
        });
        block.outputPorts.forEach((port) => {
            const solvedRate = solved.outputRates.find(or => or.itemId === port.itemId);
            if (solvedRate) port.rate = solvedRate.rate;
        });

        const { size } = calculateBlockDimensions(block.inputPorts.length, block.outputPorts.length);
        block.size = size;
    }
};

const getDownstreamDemand = (nodeId: string, portId: string, nodes: BlockNode[], edges: Edge[], visited: Set<string> = new Set()): number => {
    const key = `${nodeId}-${portId}`;
    if (visited.has(key)) return 0;
    visited.add(key);

    const edge = edges.find(e => e.source === nodeId && e.sourceHandle === portId);
    if (!edge) return 0;
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!targetNode) return 0;

    if (targetNode.type === 'block') {
        const data = targetNode.data as Block;
        const port = data.inputPorts.find(p => p.id === edge.targetHandle);
        return port?.rate ?? 0;
    } else if (targetNode.type === 'splitter') {
        const data = targetNode.data as SplitterNodeData;
        // A splitter's demand is the sum of its output demands
        return data.outputPorts.reduce((sum, p) => sum + getDownstreamDemand(targetNode.id, p.id, nodes, edges, visited), 0);
    }
    return 0;
};

const updateEdgeStatus = (edge: Edge, nodes: BlockNode[], game: any): Edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const sourcePort = getPort(sourceNode, edge.sourceHandle ?? null, 'output');
    const targetPort = getPort(targetNode, edge.targetHandle ?? null, 'input');

    if (!sourcePort || !targetPort) return edge;

    const edgeData = (edge.data as BeltEdgeData) || {
        beltId: game.belts[0].id,
        capacity: beltItemsPerMinute(game.belts[0]),
        flowRate: 0,
        demandRate: 0,
        status: 'ok',
        itemId: sourcePort.itemId
    };

    const belt = game.belts.find((b: any) => b.id === edgeData.beltId) || game.belts[0];
    const capacity = beltItemsPerMinute(belt);

    const supplyRate = sourcePort.currentRate !== undefined ? sourcePort.currentRate : sourcePort.rate;
    const demandRate = targetPort.rate;

    let status: EdgeStatus = 'ok';

    // 1. Check for Logical Mismatch (Item Type)
    if (sourcePort.itemId !== targetPort.itemId && targetPort.itemId !== 'any' && sourcePort.itemId !== 'any') {
        status = 'mismatch';
    }

    // 2. Check for Starvation (Underload)
    if (status === 'ok' && demandRate > supplyRate + 0.1) {
        status = 'underload';
    }

    let collisionRects: any[] = [];

    // 3. Check for Spatial Conflicts (only if not already logically broken)
    if (status === 'ok' || status === 'underload') {
        const p1 = getPortPosition(sourceNode.data as any, sourceNode.position, sourcePort);
        const p2 = getPortPosition(targetNode.data as any, targetNode.position, targetPort);
        const midX = p1.x + (p2.x - p1.x) * 0.5;

        const points: Point[] = [
            { x: p1.x, y: p1.y },
            { x: midX, y: p1.y },
            { x: midX, y: p2.y },
            { x: p2.x, y: p2.y }
        ];

        const lanes = getLaneCount(supplyRate, capacity);
        const width = (lanes - 1) * 6 + 12;

        // GENERATE RECTS (The single source of truth)
        const segments = getChannelSegments(points, width);
        collisionRects = segments;

        const collisionBlocks = nodes;
        const conflicts = findChannelConflicts(points, width, collisionBlocks);
        const relevantConflicts = conflicts.filter(c => c.id !== sourceNode.id && c.id !== targetNode.id);

        if (relevantConflicts.length > 0) {
            status = 'conflict';
        }
    }

    return {
        ...edge,
        data: {
            ...edgeData,
            capacity,
            flowRate: supplyRate,
            demandRate,
            status,
            collisionRects
        }
    };
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
    nodes: [],
    edges: [],
    activePort: null,
    nodeConflicts: new Set(),

    onPortClick: (nodeId, portId, type) => {
        set({ activePort: { nodeId, portId, type } });
    },

    setActivePort: (port) => set({ activePort: port }),

    createAndConnect: (recipeId, position, sourcePort) => {
        const newBlockId = get().addBlock(recipeId, position);
        const nodes = get().nodes;
        const sourceNode = nodes.find(n => n.id === sourcePort.nodeId);
        const targetNode = nodes.find(n => n.id === newBlockId);

        if (!sourceNode || !targetNode) return;

        const sourcePortObj = getPort(sourceNode, sourcePort.portId ?? null, sourcePort.type);
        if (!sourcePortObj) return;

        const targetData = targetNode.data as Block;
        const targetPorts = sourcePort.type === 'output' ? targetData.inputPorts : targetData.outputPorts;
        const targetPortObj = targetPorts.find(p => p.itemId === sourcePortObj.itemId);

        if (targetPortObj) {
            const connection = sourcePort.type === 'output'
                ? { source: sourceNode.id, sourceHandle: sourcePort.portId, target: targetNode.id, targetHandle: targetPortObj.id }
                : { source: targetNode.id, sourceHandle: targetPortObj.id, target: sourceNode.id, targetHandle: sourcePort.portId };
            get().onConnect(connection);
        }
        get().recalculateFlows();
    },

    deleteBlock: (id) => {
        set({
            nodes: get().nodes.filter((n) => n.id !== id),
            edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        });
        get().recalculateFlows();
    },

    deleteEdge: (id) => {
        set({
            edges: get().edges.filter((e) => e.id !== id),
        });
        get().recalculateFlows();
    },

    updateBlock: (id, updates) => {
        set(produce((state: LayoutState) => {
            const node = state.nodes.find(n => n.id === id);
            if (!node) return;

            if (node.type === 'splitter') {
                Object.assign(node.data, updates);
                return;
            }

            const block = node.data as Block;
            const game = useGameStore.getState().game;
            Object.assign(block, updates);
            applyBlockSolver(block, game);
        }));
        get().recalculateFlows();
    },

    addSplitter: (type, position) => {
        const id = crypto.randomUUID();
        let inputPorts: Port[] = [];
        let outputPorts: Port[] = [];

        if (type === 'splitter') {
            inputPorts = [{ id: 'in-main', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }];
            outputPorts = [
                { id: 'out-1', type: 'output', side: 'right', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'out-2', type: 'output', side: 'right', offset: 0.50, itemId: 'any', rate: 0 },
                { id: 'out-3', type: 'output', side: 'right', offset: 0.75, itemId: 'any', rate: 0 }
            ];
        } else if (type === 'balancer') {
            inputPorts = [
                { id: 'in-1', type: 'input', side: 'left', offset: 0.33, itemId: 'any', rate: 0 },
                { id: 'in-2', type: 'input', side: 'left', offset: 0.66, itemId: 'any', rate: 0 }
            ];
            outputPorts = [
                { id: 'out-1', type: 'output', side: 'right', offset: 0.33, itemId: 'any', rate: 0 },
                { id: 'out-2', type: 'output', side: 'right', offset: 0.66, itemId: 'any', rate: 0 }
            ];
        } else {
            // Merger
            inputPorts = [
                { id: 'in-1', type: 'input', side: 'left', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'in-2', type: 'input', side: 'left', offset: 0.50, itemId: 'any', rate: 0 },
                { id: 'in-3', type: 'input', side: 'left', offset: 0.75, itemId: 'any', rate: 0 }
            ];
            outputPorts = [{ id: 'out-main', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }];
        }

        const newData: SplitterNodeData = {
            id, type,
            size: { width: 80, height: 80 },
            inputPorts, outputPorts, priority: 'balanced'
        };
        const newNode: BlockNode = {
            id, type: 'splitter', position, data: newData,
            origin: [0, 0] // Strict top-left origin for collision parity
        };

        set({ nodes: [...get().nodes, newNode] });
        return id;
    },

    addBlock: (recipeId, position) => {
        const game = useGameStore.getState().game;
        const recipe = game.recipes.find(r => r.id === recipeId);
        if (!recipe) return '';

        const machine = game.machines.find(m => m.id === recipe.machineId) || game.machines[0];
        const id = crypto.randomUUID();
        const solved = solveBlock(recipe, machine, 60, 1.0, recipe.outputs[0].itemId);

        const inputPorts: Port[] = solved.inputRates.map((input, index) => ({
            id: `input-${index}`, type: 'input', itemId: input.itemId, rate: input.rate, side: 'left', offset: (index + 1) / (recipe.inputs.length + 1)
        }));
        const outputPorts: Port[] = solved.outputRates.map((output, index) => ({
            id: `output-${index}`, type: 'output', itemId: output.itemId, rate: output.rate, side: 'right', offset: (index + 1) / (recipe.outputs.length + 1)
        }));

        const { size } = calculateBlockDimensions(inputPorts.length, outputPorts.length);
        const newBlock: Block = {
            id, name: recipe.name, recipeId, machineId: machine.id, targetRate: 60,
            machineCount: solved.machineCount, actualRate: solved.actualRate,
            size, inputPorts, outputPorts, speedModifier: 1.0,
            primaryOutputId: recipe.outputs[0].itemId, efficiency: 1.0
        };

        const newNode: BlockNode = {
            id, type: 'block', position, data: newBlock,
            origin: [0, 0] // Strict top-left origin for collision parity
        };
        set({ nodes: [...get().nodes, newNode] });
        return id;
    },

    onNodesChange: (changes: NodeChange[]) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) as BlockNode[] });
        // Live collision detection during drag
        get().recalculateFlows({ skipRateSolver: true });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (connection: Connection) => {
        let { source, target, sourceHandle, targetHandle } = connection;
        if (source === target || !source || !target || !sourceHandle || !targetHandle) return;

        // Strip '-drag' suffix to link to the main anchor handles
        sourceHandle = sourceHandle.replace('-drag', '');
        targetHandle = targetHandle.replace('-drag', '');

        const nodes = get().nodes;
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);
        if (!sourceNode || !targetNode) return;

        const sourcePort = getPort(sourceNode, sourceHandle, 'output');
        const targetPort = getPort(targetNode, targetHandle, 'input');
        if (!sourcePort || !targetPort) return;

        if (sourcePort.itemId !== 'any' && targetPort.itemId !== 'any' && sourcePort.itemId !== targetPort.itemId) return;

        if (get().edges.some(e => e.target === target && e.targetHandle === targetHandle)) return;

        const game = useGameStore.getState().game;
        const belt = game.belts[0];
        const newEdge: Edge = {
            id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`,
            source, target, sourceHandle, targetHandle,
            data: {
                beltId: belt.id, capacity: beltItemsPerMinute(belt),
                flowRate: sourcePort.currentRate ?? sourcePort.rate,
                demandRate: targetPort.rate, status: 'ok', itemId: sourcePort.itemId
            }
        };

        set({ edges: addEdge(newEdge, get().edges) });
        get().recalculateFlows();
    },

    recalculateFlows: (options?: { skipRateSolver?: boolean }) => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;

            // 0. Check for Node-to-Node collisions (Diagnostics)
            state.nodeConflicts = findNodeConflicts(state.nodes);

            if (!options?.skipRateSolver) {
                // 1. Reset all ports
                state.nodes.forEach(node => {
                    const d = node.data as any;
                    d.outputPorts.forEach((p: Port) => {
                        p.currentRate = (node.type === 'splitter' ? 0 : p.rate);
                    });
                    d.inputPorts.forEach((p: Port) => p.currentRate = undefined);
                });

                // 2. Iterative Propagation
                const ITERATIONS = 15;
                const connectedInputs = new Set(state.edges.map(e => `${e.target}-${e.targetHandle}`));

                for (let i = 0; i < ITERATIONS; i++) {
                    let changed = false;
                    const inputFlows = new Map<string, number>();

                    // Transfer flow across edges
                    state.edges.forEach(edge => {
                        const sourceNode = state.nodes.find(n => n.id === edge.source);
                        const sourcePort = getPort(sourceNode!, edge.sourceHandle ?? null, 'output');
                        if (!sourcePort) return;

                        const supply = sourcePort.currentRate ?? 0;
                        const targetKey = `${edge.target}-${edge.targetHandle}`;
                        inputFlows.set(targetKey, (inputFlows.get(targetKey) || 0) + supply);
                    });

                    // Process Nodes
                    state.nodes.forEach(node => {
                        const data = node.data as any;

                        if (node.type === 'block') {
                            let satisfaction = 1.0;
                            if (data.inputPorts.length > 0) {
                                const satisfactions = data.inputPorts.map((p: Port) => {
                                    if (p.rate <= 0) return 1.0;
                                    const key = `${node.id}-${p.id}`;
                                    if (!connectedInputs.has(key)) return 1.0;

                                    const incoming = inputFlows.get(key) || 0;
                                    return Math.min(1.0, incoming / p.rate);
                                });
                                satisfaction = Math.min(...satisfactions);
                            }
                            data.outputPorts.forEach((p: Port) => {
                                const newRate = p.rate * satisfaction;
                                if (Math.abs((p.currentRate ?? 0) - newRate) > 0.001) {
                                    p.currentRate = newRate;
                                    changed = true;
                                }
                            });
                        } else if (node.type === 'splitter') {
                            // Splitter logic: sum inputs, distribute to outputs based on demand
                            const totalIn = data.inputPorts.reduce((sum: number, p: Port) => sum + (inputFlows.get(`${node.id}-${p.id}`) || 0), 0);

                            const outputs = data.outputPorts as Port[];
                            if (outputs.length === 0) return;

                            const demands = outputs.map(p => getDownstreamDemand(node.id, p.id, state.nodes, state.edges));
                            const totalDemand = demands.reduce((a, b) => a + b, 0);

                            // ITEM TYPE & DEMAND PROPAGATION:
                            const incomingEdges = state.edges.filter(e => e.target === node.id);
                            const incomingItem = incomingEdges.map(e => {
                                const sNode = state.nodes.find(n => n.id === e.source);
                                if (!sNode) return null;
                                return getPort(sNode, e.sourceHandle ?? null, 'output');
                            }).find(p => p && p.itemId !== 'any')?.itemId || 'any';

                            if (data.inputPorts[0]?.itemId !== incomingItem) {
                                changed = true;
                                data.inputPorts.forEach((p: Port) => p.itemId = incomingItem);
                                data.outputPorts.forEach((p: Port) => p.itemId = incomingItem);
                            }

                            data.inputPorts.forEach((p: Port) => {
                                p.rate = totalDemand;
                            });

                            let newRates: number[] = [];

                            if (data.priority === 'balanced' || !data.priority) {
                                if (totalDemand > 0) {
                                    // Split based on demand ratio
                                    newRates = demands.map(d => (d / totalDemand) * totalIn);
                                } else {
                                    // fallback to physical split if no demand known
                                    const share = totalIn / outputs.length;
                                    newRates = outputs.map(() => share);
                                }
                            } else if (data.priority === 'out-left' || data.priority === 'out-right') {
                                const prioIdx = data.priority === 'out-left' ? 0 : 1;
                                const otherIdx = prioIdx === 0 ? 1 : 0;

                                // 1. Fill priority demand first
                                const prioTake = Math.min(totalIn, demands[prioIdx]);
                                newRates = [];
                                newRates[prioIdx] = prioTake;

                                // 2. Overflow to other
                                const remaining = totalIn - prioTake;
                                newRates[otherIdx] = remaining;

                                // 3. Fallback: if prioTake was 0 because demand was 0, but we have items,
                                // in priority mode we usually still send items to prio if we don't know demand
                                if (totalIn > 0 && totalDemand === 0) {
                                    newRates[prioIdx] = totalIn;
                                    newRates[otherIdx] = 0;
                                }
                            } else {
                                // Default to balanced
                                const share = totalIn / outputs.length;
                                newRates = outputs.map(() => share);
                            }

                            outputs.forEach((p, idx) => {
                                const newRate = newRates[idx] || 0;
                                if (Math.abs((p.currentRate ?? 0) - newRate) > 0.001) {
                                    p.currentRate = newRate;
                                    changed = true;
                                }
                            });
                        }
                    });

                    if (!changed) break;
                }
            }

            // Always update edge status (Geometry Check)
            state.edges = state.edges.map(edge => updateEdgeStatus(edge, state.nodes, game));
        }));
    },

    cycleEdgeBelt: (edgeId) => {
        set(produce((state: LayoutState) => {
            const edge = state.edges.find(e => e.id === edgeId);
            if (!edge || !edge.data) return;
            const game = useGameStore.getState().game;
            const currentIndex = game.belts.findIndex(b => b.id === edge.data.beltId);
            const nextBelt = game.belts[(currentIndex + 1) % game.belts.length];
            edge.data.beltId = nextBelt.id;
            const updated = updateEdgeStatus(edge, state.nodes, game);
            edge.data = updated.data;
        }));
    },

    exportLayout: () => {
        const data = { nodes: get().nodes, edges: get().edges, version: '1.0' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dsp-layout-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },

    importLayout: (json) => {
        try {
            const data = JSON.parse(json);
            if (data.nodes && data.edges) {
                set({ nodes: data.nodes, edges: data.edges });
                get().recalculateFlows();
            }
        } catch (e) { console.error('Failed to import layout', e); }
    },

    saveToStorage: () => {
        localStorage.setItem('dsp_layout', JSON.stringify({ nodes: get().nodes, edges: get().edges }));
    },

    loadFromStorage: () => {
        const stored = localStorage.getItem('dsp_layout');
        if (stored) get().importLayout(stored);
    },

    refreshGlobalRates: () => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;
            state.nodes.forEach(node => {
                if (node.type === 'block') {
                    applyBlockSolver(node.data as Block, game);
                }
            });
        }));
        get().recalculateFlows();
    }
}));

useGameStore.subscribe(() => {
    useLayoutStore.getState().refreshGlobalRates();
});
