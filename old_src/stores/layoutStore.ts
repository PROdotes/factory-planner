
import { create } from 'zustand';
import { produce } from 'immer';
import { Connection, EdgeChange, NodeChange, applyEdgeChanges, applyNodeChanges, XYPosition } from 'reactflow';
import { Block, BlockNode, EdgeData, LayoutState, Port, getPortPosition, isBlock } from '@/types/block';
import { beltItemsPerUnit } from '@/lib/rates';
import { updateEdgeBeltTier, recalculateLayoutFlows } from '@/lib/solver/layoutFlowSolver';
import { applyBlockSolver } from '@/lib/solver/blockSolver';
import { saveLayoutToStorage, loadLayoutFromStorage, exportLayoutData, parseLayoutImport } from '@/lib/io/layoutStorage';
import { useGameStore } from '@/stores/gameStore';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

import { getPort } from '@/lib/layout/edgeStatus';

export const useLayoutStore = create<LayoutState>((set, get) => ({
    nodes: [],
    edges: [],
    draggingItem: null,
    activePort: null,
    nodeConflicts: new Set(),
    viewSettings: {
        showRates: true,
        showFlow: true,
        snapToGrid: true,
        flowMode: false,
        showLabels: true,
        showDebugBounds: true,
        bundleLanes: false,
        autoIncrementSource: false
    },

    setViewSettings: (settings) => {
        set((state) => ({
            viewSettings: { ...state.viewSettings, ...settings }
        }));
        get().recalculateFlows();
    },

    toggleViewSetting: (key) => {
        set((state) => ({
            viewSettings: { ...state.viewSettings, [key]: !state.viewSettings[key] }
        }));
        if (key === 'flowMode' || key === 'autoIncrementSource') {
            get().recalculateFlows();
        }
    },

    setDraggingItem: (item) => set({ draggingItem: item }),
    setActivePort: (port, position) => {
        set({ activePort: (port && position ? { ...port, position } : null) as any });
    },

    onNodesChange: (changes: NodeChange[]) => {
        const currentNodes = get().nodes;
        const nextNodes = applyNodeChanges(changes, currentNodes);

        // Handle deletions
        const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
        if (removedIds.length > 0) {
            set({
                nodes: nextNodes as BlockNode[],
                edges: get().edges.filter(e => !removedIds.includes(e.source) && !removedIds.includes(e.target))
            });
            get().recalculateFlows();
            return;
        }

        set({ nodes: nextNodes as BlockNode[] });

        const dragChange = changes.find((c): c is any => c.type === 'position' && !!c.dragging);
        const hasPositionChange = changes.some(c => c.type === 'position' && !c.dragging);

        // If dragging, perform partial/focused updates for performance
        if (dragChange) {
            get().recalculateFlows({
                skipRateSolver: true,
                onlyRouteNodeId: dragChange.id
            });
        } else if (hasPositionChange) {
            // Full solve only on drag stop.
            get().recalculateFlows({ skipRateSolver: true });
        }
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        const nextEdges = applyEdgeChanges(changes, get().edges);
        set({ edges: nextEdges });

        if (changes.some(c => c.type === 'remove')) {
            get().recalculateFlows();
        }
    },

    onConnect: (connection: Connection) => {
        let { source, target, sourceHandle, targetHandle } = connection;
        if (source === target || !source || !target || !sourceHandle || !targetHandle) return;

        sourceHandle = sourceHandle.replace('-drag', '');
        targetHandle = targetHandle.replace('-drag', '');

        const nodes = get().nodes;
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);
        if (!sourceNode || !targetNode) return;

        const flowMode = get().viewSettings.flowMode;
        const game = useGameStore.getState().game;

        const sourcePort = getPort(sourceNode, sourceHandle, 'output');
        const targetPort = getPort(targetNode, targetHandle, 'input');
        if (!sourcePort || !targetPort) return;

        if (sourcePort.itemId !== 'any' && targetPort.itemId !== 'any' && sourcePort.itemId !== targetPort.itemId) return;

        const existingTargetEdge = get().edges.find(e => e.target === target && e.targetHandle === targetHandle);
        if (existingTargetEdge) {
            if (existingTargetEdge.source === source && existingTargetEdge.sourceHandle === sourceHandle) {
                return;
            }
        }

        const sourcePortPos = getPortPosition(sourceNode.data, sourceNode.position, sourcePort, flowMode, game);
        const targetPortPos = getPortPosition(targetNode.data, targetNode.position, targetPort, flowMode, game);

        // CHECK TARGET COLLISION (Merging)
        if (existingTargetEdge) {
            // AUTO-MERGER LOGIC
            const oldSourceNode = get().nodes.find(n => n.id === existingTargetEdge.source);
            let oldSourcePortPos: XYPosition;
            if (oldSourceNode) {
                const oldSourcePort = getPort(oldSourceNode, existingTargetEdge.sourceHandle ?? null, 'output')!;
                oldSourcePortPos = getPortPosition(oldSourceNode.data, oldSourceNode.position, oldSourcePort, flowMode, game);
            } else {
                oldSourcePortPos = { x: targetPortPos.x - LAYOUT_METRICS.routing.fallbackPortOffset, y: targetPortPos.y };
            }

            const dx = oldSourcePortPos.x - targetPortPos.x;
            const dy = oldSourcePortPos.y - targetPortPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            const targetDist = flowMode ? LAYOUT_METRICS.routing.splitterPlacementDistance.flow : LAYOUT_METRICS.routing.splitterPlacementDistance.standard;
            const dist = len > 0 ? Math.min(targetDist, len * 0.4) : targetDist;
            const splitterSize = flowMode ? LAYOUT_METRICS.flow.splitterSize : LAYOUT_METRICS.block.splitterSize;

            const splitterPos = {
                x: (targetPortPos.x + (len > 0 ? (dx / len) : -1) * dist) - (splitterSize / 2),
                y: targetPortPos.y - (splitterSize / 2)
            };

            if (Math.abs(dy) > Math.abs(dx) * 1.5) {
                splitterPos.y = (targetPortPos.y + (dy / len) * dist) - (splitterSize / 2);
            }

            const splitterId = crypto.randomUUID();
            const splitterNode: BlockNode = {
                id: splitterId, type: 'splitter', position: splitterPos,
                data: {
                    id: splitterId, type: 'splitter', priority: 'balanced',
                    inputPorts: [
                        { id: 'in-1', type: 'input', side: 'left', offset: 0.25, itemId: 'any', rate: 0 },
                        { id: 'in-2', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 },
                        { id: 'in-3', type: 'input', side: 'left', offset: 0.75, itemId: 'any', rate: 0 }
                    ],
                    outputPorts: [
                        { id: 'out-main', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }
                    ]
                }
            };

            const belt = useGameStore.getState().game.belts[0];
            const capacity = beltItemsPerUnit(belt, game.settings.rateUnit);

            set({
                nodes: [...get().nodes, splitterNode],
                edges: [
                    ...get().edges.filter(e => e.id !== existingTargetEdge.id),
                    { id: `e-${existingTargetEdge.source}-to-${splitterId}`, source: existingTargetEdge.source, target: splitterId, sourceHandle: existingTargetEdge.sourceHandle, targetHandle: 'in-1', data: { beltId: belt.id, capacity, flowRate: 0, demandRate: 0, status: 'ok', itemId: 'any' } },
                    { id: `e-${source}-to-${splitterId}`, source, target: splitterId, sourceHandle, targetHandle: 'in-2', data: { beltId: belt.id, capacity, flowRate: sourcePort.rate, demandRate: 0, status: 'ok', itemId: sourcePort.itemId } },
                    { id: `e-${splitterId}-to-${target}`, source: splitterId, target, sourceHandle: 'out-main', targetHandle, data: { beltId: belt.id, capacity, flowRate: targetPort.rate, demandRate: targetPort.rate, status: 'ok', itemId: sourcePort.itemId } }
                ]
            });
            get().recalculateFlows();
            return;
        }

        // Check for SOURCE COLLISION (Splitting)
        const existingEdge = get().edges.find(e => e.source === source && e.sourceHandle === sourceHandle);
        if (existingEdge) {
            // AUTO-SPLITTER LOGIC
            const oldTargetNode = get().nodes.find(n => n.id === existingEdge.target);
            let oldTargetPortPos: XYPosition;
            if (oldTargetNode) {
                const oldTargetPort = getPort(oldTargetNode, existingEdge.targetHandle ?? null, 'input')!;
                oldTargetPortPos = getPortPosition(oldTargetNode.data, oldTargetNode.position, oldTargetPort, flowMode, game);
            } else {
                oldTargetPortPos = { x: sourcePortPos.x + LAYOUT_METRICS.routing.fallbackPortOffset, y: sourcePortPos.y };
            }

            const dx = oldTargetPortPos.x - sourcePortPos.x;
            const dy = oldTargetPortPos.y - sourcePortPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            const targetDist = flowMode ? LAYOUT_METRICS.routing.splitterPlacementDistance.flow : LAYOUT_METRICS.routing.splitterPlacementDistance.standard;
            const dist = len > 0 ? Math.min(targetDist, len * 0.4) : targetDist;
            const splitterSize = flowMode ? LAYOUT_METRICS.flow.splitterSize : LAYOUT_METRICS.block.splitterSize;

            const splitterPos = {
                x: (sourcePortPos.x + (len > 0 ? (dx / len) : 1) * dist) - (splitterSize / 2),
                y: sourcePortPos.y - (splitterSize / 2)
            };

            if (Math.abs(dy) > Math.abs(dx) * 1.5) {
                splitterPos.y = (sourcePortPos.y + (dy / len) * dist) - (splitterSize / 2);
            }

            const splitterId = crypto.randomUUID();
            const splitterNode: BlockNode = {
                id: splitterId, type: 'splitter', position: splitterPos,
                data: {
                    id: splitterId, type: 'splitter', priority: 'balanced',
                    inputPorts: [
                        { id: 'in-main', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }
                    ],
                    outputPorts: [
                        { id: 'out-1', type: 'output', side: 'right', offset: 0.25, itemId: 'any', rate: 0 },
                        { id: 'out-2', type: 'output', side: 'right', offset: 0.50, itemId: 'any', rate: 0 },
                        { id: 'out-3', type: 'output', side: 'right', offset: 0.75, itemId: 'any', rate: 0 }
                    ]
                }
            };

            const belt = useGameStore.getState().game.belts[0];
            const capacity = beltItemsPerUnit(belt, game.settings.rateUnit);
            const rate = sourcePort.currentRate ?? sourcePort.rate;

            set({
                nodes: [...get().nodes, splitterNode],
                edges: [
                    ...get().edges.filter(e => e.id !== existingEdge.id),
                    { id: `e-${source}-to-${splitterId}`, source, target: splitterId, sourceHandle, targetHandle: 'in-main', data: { beltId: belt.id, capacity, flowRate: rate, demandRate: rate, status: 'ok', itemId: sourcePort.itemId } },
                    { id: `e-${splitterId}-to-old-${existingEdge.target}`, source: splitterId, target: existingEdge.target, sourceHandle: 'out-1', targetHandle: existingEdge.targetHandle, data: { beltId: belt.id, capacity, flowRate: 0, demandRate: 0, status: 'ok', itemId: sourcePort.itemId } },
                    { id: `e-${splitterId}-to-new-${target}`, source: splitterId, target, sourceHandle: 'out-2', targetHandle, data: { beltId: belt.id, capacity, flowRate: targetPort.rate, demandRate: targetPort.rate, status: 'ok', itemId: sourcePort.itemId } }
                ]
            });
            get().recalculateFlows();
            return;
        }

        const belt = useGameStore.getState().game.belts[0];
        const capacity = beltItemsPerUnit(belt, game.settings.rateUnit);

        const edgeId = `e-${source}-${sourceHandle}-to-${target}-${targetHandle}`;
        const newEdge = {
            id: edgeId, source, target, sourceHandle, targetHandle,
            data: { beltId: belt.id, capacity, flowRate: sourcePort.rate, demandRate: targetPort.rate, status: 'ok', itemId: sourcePort.itemId } as EdgeData
        };

        set({ edges: [...get().edges, newEdge] });
        get().recalculateFlows();
    },

    onPortClick: (nodeId, portId, type) => {
        const active = get().activePort;
        if (!active) {
            const node = get().nodes.find(n => n.id === nodeId);
            const flowMode = get().viewSettings.flowMode;
            const game = useGameStore.getState().game;
            // Calculate heuristic position if click event didn't provide one
            const portDef = getPort(node!, portId, type)!;
            const pos = getPortPosition(node!.data, node!.position, portDef, flowMode, game);
            get().setActivePort({ nodeId, portId, type }, pos);
            return;
        }

        // Complete connection
        if (active.nodeId === nodeId && active.portId === portId) {
            get().setActivePort(null); // Toggle off
            return;
        }

        // Check polarity
        if (active.type === type) {
            // Switch active port
            const node = get().nodes.find(n => n.id === nodeId);
            const flowMode = get().viewSettings.flowMode;
            const game = useGameStore.getState().game;
            const portDef = getPort(node!, portId, type)!;
            const pos = getPortPosition(node!.data, node!.position, portDef, flowMode, game);
            get().setActivePort({ nodeId, portId, type }, pos);
            return;
        }

        // Attempt connect
        const source = active.type === 'output' ? active : { nodeId, portId, type };
        const target = active.type === 'input' ? active : { nodeId, portId, type };

        get().onConnect({
            source: source.nodeId, sourceHandle: source.portId,
            target: target.nodeId, targetHandle: target.portId
        } as Connection);

        get().setActivePort(null);
    },

    onNodeDragStop: (_) => {
        get().recalculateFlows();
    },

    recalculateFlows: (options) => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;
            recalculateLayoutFlows(state, game, {
                ...options,
                flowMode: state.viewSettings.flowMode
            });
        }));
    },

    cycleEdgeBelt: (edgeId) => {
        set(produce((state: LayoutState) => {
            const edgeIndex = state.edges.findIndex((edge) => edge.id === edgeId);
            if (edgeIndex === -1) return;
            const game = useGameStore.getState().game;
            state.edges[edgeIndex] = updateEdgeBeltTier(state.edges[edgeIndex], state.nodes, game);
        }));
    },

    exportLayout: () => {
        const data = exportLayoutData(get().nodes, get().edges);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dsp-layout-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        window.setTimeout(() => {
            URL.revokeObjectURL(url);
            link.remove();
        }, 1000);
    },

    importLayout: (json) => {
        const data = parseLayoutImport(json);
        if (data) {
            set({ nodes: data.nodes, edges: data.edges });
            get().recalculateFlows();
        }
    },

    saveToStorage: () => {
        saveLayoutToStorage(get().nodes, get().edges);
    },

    loadFromStorage: () => {
        const stored = loadLayoutFromStorage();
        if (stored) {
            set({ nodes: stored.nodes, edges: stored.edges });
            get().recalculateFlows();
        }
    },

    resetLayout: () => {
        set({ nodes: [], edges: [] });
    },

    refreshGlobalRates: () => {
        set(produce((state: LayoutState) => {
            const game = useGameStore.getState().game;
            state.nodes.forEach(node => {
                if (node.type === 'block') {
                    applyBlockSolver(node.data as Block, game);
                }
            });
            recalculateLayoutFlows(state, game, {
                flowMode: state.viewSettings.flowMode
            });
        }));
    },

    addSplitter: (type, position) => {
        const id = crypto.randomUUID();
        // Use single-port convention to match auto-splitter logic
        let inputPorts: Port[] = [];
        let outputPorts: Port[] = [];

        if (type === 'merger') {
            inputPorts = [
                { id: 'in-1', type: 'input', side: 'left', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'in-2', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 },
                { id: 'in-3', type: 'input', side: 'left', offset: 0.75, itemId: 'any', rate: 0 }
            ];
            outputPorts = [
                { id: 'out-main', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }
            ];
        } else {
            // Splitter
            inputPorts = [
                { id: 'in-main', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }
            ];
            outputPorts = [
                { id: 'out-1', type: 'output', side: 'right', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'out-2', type: 'output', side: 'right', offset: 0.50, itemId: 'any', rate: 0 },
                { id: 'out-3', type: 'output', side: 'right', offset: 0.75, itemId: 'any', rate: 0 }
            ];
        }

        const newNode: BlockNode = {
            id, type: 'splitter', position,
            data: {
                id, type, priority: 'balanced',
                inputPorts, outputPorts
            }
        };

        set({ nodes: [...get().nodes, newNode] });
        get().recalculateFlows();
        try { window.dispatchEvent(new Event('debugBounds:recompute')); } catch (e) {}
        return id;
    },

    addBlock: (recipeId, position, options) => {
        const id = crypto.randomUUID();
        const game = useGameStore.getState().game;
        const recipe = game.recipes.find(r => r.id === recipeId);
        if (!recipe) return '';

        const inputPorts: Port[] = recipe.inputs.map((input, idx) => ({
            id: `in-${idx}`, type: 'input', itemId: input.itemId, rate: 0,
            side: 'left', offset: (idx + 1) / (recipe.inputs.length + 1)
        }));

        const outputPorts: Port[] = recipe.outputs.map((output, idx) => ({
            id: `out-${idx}`, type: 'output', itemId: output.itemId, rate: 0,
            side: 'right', offset: (idx + 1) / (recipe.outputs.length + 1)
        }));

        const newNode: BlockNode = {
            id, type: 'block', position,
            data: {
                id, type: 'block', name: recipe.name, recipeId, machineId: recipe.machineId,
                calculationMode: 'output', targetRate: options?.targetRate || 60, machineCount: 1,
                actualRate: 0, speedModifier: 1, efficiency: 1,
                inputPorts, outputPorts,
                primaryOutputId: options?.primaryOutputId
            }
        };
        set({ nodes: [...get().nodes, newNode] });
        get().refreshGlobalRates();
        try { window.dispatchEvent(new Event('debugBounds:recompute')); } catch (e) {}
        return id;
    },

    updateBlock: (id, updates) => {
        set(produce((state: LayoutState) => {
            const node = state.nodes.find(n => n.id === id);
            if (node) {
                Object.assign(node.data, updates);
                if (node.type === 'block') {
                    const game = useGameStore.getState().game;
                    applyBlockSolver(node.data as Block, game);
                }
            }
            const game = useGameStore.getState().game;
            recalculateLayoutFlows(state, game, {
                flowMode: state.viewSettings.flowMode
            });
        }));
    },

    deleteBlock: (id) => {
        set((state) => ({
            nodes: state.nodes.filter(n => n.id !== id),
            edges: state.edges.filter(e => e.source !== id && e.target !== id)
        }));
        get().recalculateFlows();
    },

    deleteEdge: (id) => {
        set((state) => ({
            edges: state.edges.filter(e => e.id !== id)
        }));
        get().recalculateFlows();
    },

    createAndConnect: (recipeId, position, sourcePort) => {
        const newBlockId = get().addBlock(recipeId, position);

        if (sourcePort.type === 'output') {
            const newNode = get().nodes.find(n => n.id === newBlockId);
            if (newNode && isBlock(newNode.data)) {
                const targetPort = newNode.data.inputPorts.find(p => p.itemId === sourcePort.itemId)
                    || newNode.data.inputPorts[0];

                if (targetPort) {
                    get().onConnect({
                        source: sourcePort.nodeId,
                        sourceHandle: sourcePort.portId,
                        target: newBlockId,
                        targetHandle: targetPort.id
                    } as Connection);
                }
            }
        } else {
            const newNode = get().nodes.find(n => n.id === newBlockId);
            if (newNode && isBlock(newNode.data)) {
                const sourceHandle = newNode.data.outputPorts.find(p => p.itemId === sourcePort.itemId)
                    || newNode.data.outputPorts[0];

                if (sourceHandle) {
                    get().onConnect({
                        source: newBlockId,
                        sourceHandle: sourceHandle.id,
                        target: sourcePort.nodeId,
                        targetHandle: sourcePort.portId
                    } as Connection);
                }
            }
        }
        get().setActivePort(null);
    },
}));

useGameStore.subscribe(() => {
    useLayoutStore.getState().refreshGlobalRates();
});
