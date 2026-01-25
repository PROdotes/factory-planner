import { create } from 'zustand';
import { produce } from 'immer';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges
} from 'reactflow';
import { Block, Port, BeltEdgeData, EdgeStatus } from '@/types/block';
import { useGameStore } from './gameStore';
import { beltItemsPerMinute } from '@/types/game';
import { solveBlock } from '@/lib/solver/rateSolver';

// We'll use this Type for our React Flow nodes
// The 'data' field will contain our Block interface
export type BlockNode = Node<Block>;

export interface ActivePort {
    nodeId: string;
    portId: string;
    type: 'input' | 'output';
}

interface LayoutState {
    nodes: BlockNode[];
    edges: Edge[];
    activePort: ActivePort | null;

    // Actions
    addBlock: (recipeId: string, position: { x: number; y: number }) => string;
    updateBlock: (id: string, updates: Partial<Block>) => void;
    deleteBlock: (id: string) => void;
    deleteEdge: (id: string) => void;
    onPortClick: (nodeId: string, portId: string, type: 'input' | 'output') => void;
    setActivePort: (port: ActivePort | null) => void;
    // React Flow handlers
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    createAndConnect: (recipeId: string, position: { x: number; y: number }, sourcePort: ActivePort) => void;

    recalculateFlows: () => void;
    cycleEdgeBelt: (edgeId: string) => void;
    exportLayout: () => void;
    importLayout: (json: string) => void;
    saveToStorage: () => void;
    loadFromStorage: () => void;
    refreshGlobalRates: () => void;
}

const updateEdgeStatus = (edge: Edge, nodes: BlockNode[], game: any): Edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const sourcePort = sourceNode.data.outputPorts.find(p => p.id === edge.sourceHandle);
    const targetPort = targetNode.data.inputPorts.find(p => p.id === edge.targetHandle);
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

    // Use currentRate (constrained) if available, else theoretical rate
    const supplyRate = sourcePort.currentRate !== undefined ? sourcePort.currentRate : sourcePort.rate;
    const demandRate = targetPort.rate;

    let status: EdgeStatus = 'ok';

    if (supplyRate > capacity + 0.01) {
        status = 'bottleneck';
    } else if (demandRate > capacity + 0.01) {
        status = 'overload';
    } else if (demandRate > Math.min(supplyRate, capacity) + 0.01) {
        status = 'underload';
    }

    return {
        ...edge,
        data: {
            ...edgeData,
            capacity,
            flowRate: Math.min(supplyRate, capacity),
            demandRate,
            status
        }
    };
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
    nodes: [],
    edges: [],
    activePort: null,

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

        // Find correct port on the new block
        // If we clicked an OUTPUT on the source, we connect to an INPUT on the target.
        const sourcePortObj = sourcePort.type === 'output'
            ? sourceNode.data.outputPorts.find(p => p.id === sourcePort.portId)
            : sourceNode.data.inputPorts.find(p => p.id === sourcePort.portId);

        if (!sourcePortObj) return;

        const targetPorts = sourcePort.type === 'output'
            ? targetNode.data.inputPorts
            : targetNode.data.outputPorts;

        const targetPortObj = targetPorts.find(p => p.itemId === sourcePortObj.itemId);

        if (targetPortObj) {
            if (sourcePort.type === 'output') {
                get().onConnect({
                    source: sourceNode.id,
                    sourceHandle: sourcePort.portId,
                    target: targetNode.id,
                    targetHandle: targetPortObj.id
                });
            } else {
                get().onConnect({
                    source: targetNode.id,
                    sourceHandle: targetPortObj.id,
                    target: sourceNode.id,
                    targetHandle: sourcePort.portId
                });
            }
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

            const block = node.data;
            const game = useGameStore.getState().game;

            // 1. Update the block data
            Object.assign(block, updates);

            // 2. Re-solve the block math
            const recipe = game.recipes.find(r => r.id === block.recipeId);
            const machine = game.machines.find(m => m.id === block.machineId) || game.machines[0];

            if (recipe && machine) {
                // Calculate Modifiers
                let speedMult = block.speedModifier || 1.0;
                let prodBonus = 0.0;

                if (block.modifier) {
                    if (block.modifier.type === 'speed') {
                        // Level 1=25%, 2=50%, 3=100%
                        if (block.modifier.level === 1) speedMult *= 1.25;
                        if (block.modifier.level === 2) speedMult *= 1.50;
                        if (block.modifier.level === 3) speedMult *= 2.00;
                    } else if (block.modifier.type === 'productivity') {
                        // Level 1=12.5%, 2=20%, 3=25%
                        if (block.modifier.level === 1) prodBonus = 0.125;
                        if (block.modifier.level === 2) prodBonus = 0.20;
                        if (block.modifier.level === 3) prodBonus = 0.25;
                    }
                }

                const solved = solveBlock(
                    recipe,
                    machine,
                    block.targetRate,
                    speedMult,
                    block.primaryOutputId,
                    prodBonus
                );

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
            }

            // 3. ATOMIC AUDIT: Update all connected edges using the fresh node data in this draft
        }));

        get().recalculateFlows();
    },

    addBlock: (recipeId, position) => {
        const game = useGameStore.getState().game;
        const recipe = game.recipes.find(r => r.id === recipeId);

        if (!recipe) {
            console.error(`Recipe ${recipeId} not found`);
            return '';
        }

        const machine = game.machines.find(m => m.id === recipe.machineId) || game.machines[0];
        const id = crypto.randomUUID();

        // Initial Solve
        const solved = solveBlock(recipe, machine, 60, 1.0, recipe.outputs[0].itemId); // Default to 60/min output

        // Calculate Ports with visual positioning
        const inputPorts: Port[] = solved.inputRates.map((input, index) => ({
            id: `input-${index}`,
            type: 'input',
            itemId: input.itemId,
            rate: input.rate,
            side: 'left',
            offset: (index + 1) / (recipe.inputs.length + 1)
        }));

        const outputPorts: Port[] = solved.outputRates.map((output, index) => ({
            id: `output-${index}`,
            type: 'output',
            itemId: output.itemId,
            rate: output.rate,
            side: 'right',
            offset: (index + 1) / (recipe.outputs.length + 1)
        }));

        const newBlock: Block = {
            id,
            name: recipe.name,
            recipeId,
            machineId: machine.id,
            targetRate: 60,
            machineCount: solved.machineCount,
            actualRate: solved.actualRate,
            position,
            size: { width: 250, height: 180 }, // Slightly taller for more ports
            inputPorts,
            outputPorts,
            speedModifier: 1.0,
            primaryOutputId: recipe.outputs[0].itemId
        };

        const newNode: BlockNode = {
            id,
            type: 'block',
            position,
            data: newBlock,
        };

        set({ nodes: [...get().nodes, newNode] });
        return id;
    },

    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes) as BlockNode[],
        });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection: Connection) => {
        const { source, target, sourceHandle, targetHandle } = connection;

        // 1. Prevent self-connections
        if (source === target) {
            console.warn('Cannot connect a block to itself');
            return;
        }

        const nodes = get().nodes;
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);

        if (!sourceNode || !targetNode) return;

        // 2. Find the actual port objects
        // Source is usually an output port, Target is an input port
        const sourcePort = sourceNode.data.outputPorts.find(p => p.id === sourceHandle);
        const targetPort = targetNode.data.inputPorts.find(p => p.id === targetHandle);

        if (!sourcePort || !targetPort) {
            console.warn('Could not find ports for connection');
            return;
        }

        // 3. Check for Item Mismatch
        if (sourcePort.itemId !== targetPort.itemId) {
            console.warn(`Item mismatch: Cannot connect ${sourcePort.itemId} to ${targetPort.itemId}`);
            // TODO: In the future, we might allow this but show a warning visual, 
            // but for now let's strict block it to prevent confusion
            return;
        }

        // 4. Check if target port is already connected?
        // In DSP, one belt into one port.
        const targetIsOccupied = get().edges.some(e => e.target === target && e.targetHandle === targetHandle);
        if (targetIsOccupied) {
            console.warn('Target port is already occupied');
            return;
        }

        if (!source || !target || !sourceHandle || !targetHandle) return;

        const game = useGameStore.getState().game;
        const belt = game.belts[0];
        const capacity = beltItemsPerMinute(belt);
        const initialSupply = sourcePort.currentRate ?? sourcePort.rate;
        const newEdge: Edge = {
            id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`,
            source,
            target,
            sourceHandle,
            targetHandle,
            data: {
                beltId: belt.id,
                capacity,
                flowRate: Math.min(initialSupply, capacity),
                demandRate: targetPort.rate,
                status: 'ok',
                itemId: sourcePort.itemId
            }
        };

        set({
            edges: addEdge(newEdge, get().edges),
        });

        get().recalculateFlows();
    },

    recalculateFlows: () => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;
            // 1. Reset all ports to optimistic rates
            state.nodes.forEach(node => {
                node.data.outputPorts.forEach(p => p.currentRate = p.rate);
                node.data.inputPorts.forEach(p => p.currentRate = undefined);
            });

            // 2. Iterative Propagation (Simple fixed passes for now, max 10 passes for depth)
            const ITERATIONS = 10;
            const connectedInputs = new Set<string>();
            state.edges.forEach(edge => {
                connectedInputs.add(`${edge.target}-${edge.targetHandle}`);
            });
            for (let i = 0; i < ITERATIONS; i++) {
                let changed = false;

                // Temp map for input flow accumulation
                const inputFlows = new Map<string, number>(); // portId -> flow

                // A. Transfer: Calc flow on edges based on Source.currentRate
                state.edges.forEach(edge => {
                    const sourceNode = state.nodes.find(n => n.id === edge.source);
                    const sourcePort = sourceNode?.data.outputPorts.find(p => p.id === edge.sourceHandle);

                    if (!sourcePort) return;

                    const edgeData = edge.data as BeltEdgeData;
                    const belt = game.belts.find(b => b.id === edgeData.beltId) || game.belts[0];
                    const capacity = beltItemsPerMinute(belt);

                    const supply = sourcePort.currentRate !== undefined ? sourcePort.currentRate : sourcePort.rate;
                    const flow = Math.min(supply, capacity);

                    const targetKey = `${edge.target}-${edge.targetHandle}`;
                    inputFlows.set(targetKey, (inputFlows.get(targetKey) || 0) + flow);
                });

                // B. Process: Calc node satisfaction and update Output.currentRate
                state.nodes.forEach(node => {
                    const block = node.data;

                    // Calculate Satisfaction
                    let satisfaction = 1.0;
                    if (block.inputPorts.length > 0) {
                        const satisfactions = block.inputPorts.map(port => {
                            const needed = port.rate; // This is the "Required" rate
                            if (needed <= 0) return 1.0;
                            const portKey = `${node.id}-${port.id}`;
                            if (!connectedInputs.has(portKey)) return 1.0;
                            const incoming = inputFlows.get(portKey) || 0;
                            return Math.min(1.0, incoming / needed);
                        });
                        satisfaction = Math.min(...satisfactions);
                    }

                    // Update Outputs
                    block.outputPorts.forEach(port => {
                        const newRate = port.rate * satisfaction;
                        // Initial p.currentRate is p.rate. 
                        const diff = Math.abs((port.currentRate ?? 0) - newRate);
                        if (diff > 0.001) {
                            port.currentRate = newRate;
                            changed = true;
                        }
                    });
                });

                // Force at least one pass to debug
                if (!changed) break;
            }

            // 3. Final Edge Status Update
            state.edges = state.edges.map(edge => updateEdgeStatus(edge, state.nodes, game));
        }));
    },

    cycleEdgeBelt: (edgeId: string) => {
        set(produce((state: LayoutState) => {
            const edge = state.edges.find(e => e.id === edgeId);
            if (!edge || !edge.data) return;

            const game = useGameStore.getState().game;
            const currentBeltId = (edge.data as BeltEdgeData).beltId;
            const currentIndex = game.belts.findIndex(b => b.id === currentBeltId);
            const nextIndex = (currentIndex + 1) % game.belts.length;
            const nextBelt = game.belts[nextIndex];

            // Update parameters
            edge.data.beltId = nextBelt.id;

            // Trigger status update for this edge specifically within the draft
            const updatedEdge = updateEdgeStatus(edge, state.nodes, game);
            edge.data = updatedEdge.data;
        }));
    },

    exportLayout: () => {
        const data = {
            nodes: get().nodes,
            edges: get().edges,
            version: '1.0'
        };
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
                set({
                    nodes: data.nodes,
                    edges: data.edges
                });
                get().recalculateFlows();
            }
        } catch (e) {
            console.error('Failed to import layout', e);
        }
    },

    saveToStorage: () => {
        const data = {
            nodes: get().nodes,
            edges: get().edges
        };
        localStorage.setItem('dsp_layout', JSON.stringify(data));
    },

    loadFromStorage: () => {
        const stored = localStorage.getItem('dsp_layout');
        if (stored) {
            get().importLayout(stored);
        }
    },

    refreshGlobalRates: () => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;

            // 1. Re-Solve all blocks with potentially new game data
            state.nodes.forEach((node) => {
                const block = node.data;
                // 2. Re-solve the block math
                const recipe = game.recipes.find(r => r.id === block.recipeId);
                const machine = game.machines.find(m => m.id === block.machineId) || game.machines[0];

                if (recipe && machine) {
                    // Calculate Modifiers
                    let speedMult = block.speedModifier || 1.0;
                    let prodBonus = 0.0;

                    if (block.modifier) {
                        if (block.modifier.type === 'speed') {
                            // Level 1=25%, 2=50%, 3=100%
                            if (block.modifier.level === 1) speedMult *= 1.25;
                            if (block.modifier.level === 2) speedMult *= 1.50;
                            if (block.modifier.level === 3) speedMult *= 2.00;
                        } else if (block.modifier.type === 'productivity') {
                            // Level 1=12.5%, 2=20%, 3=25%
                            if (block.modifier.level === 1) prodBonus = 0.125;
                            if (block.modifier.level === 2) prodBonus = 0.20;
                            if (block.modifier.level === 3) prodBonus = 0.25;

                            // Note: In DSP, Prod Spray increases power but keeps speed same.
                            // However, some games equate Prod with Speed penalty (Factorio).
                            // Our default is neutral speed unless specified.
                        }
                    }

                    const solved = solveBlock(
                        recipe,
                        machine,
                        block.targetRate,
                        speedMult,
                        block.primaryOutputId,
                        prodBonus
                    );

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
                }
            });

            // 2. Update Edges
            state.edges = state.edges.map(edge => updateEdgeStatus(edge, state.nodes, game));
        }));
    }
}));

// Subscribe to Game Store changes to auto-update layout
useGameStore.subscribe(() => {
    useLayoutStore.getState().refreshGlobalRates();
});
