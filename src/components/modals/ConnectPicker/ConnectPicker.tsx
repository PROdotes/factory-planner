import React, { useMemo } from 'react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useGameStore } from '@/stores/gameStore';
import { Recipe } from '@/types/game';

interface ConnectPickerProps {
    onCancel: () => void;
}

export const ConnectPicker: React.FC<ConnectPickerProps> = ({ onCancel }) => {
    const activePort = useLayoutStore((state) => state.activePort);
    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const onConnect = useLayoutStore((state) => state.onConnect);
    const { game } = useGameStore();

    if (!activePort) return null;

    const sourceNode = nodes.find(n => n.id === activePort.nodeId);
    if (!sourceNode) return null;

    const sourcePort = activePort.type === 'input'
        ? sourceNode.data.inputPorts.find(p => p.id === activePort.portId)
        : sourceNode.data.outputPorts.find(p => p.id === activePort.portId);

    if (!sourcePort) return null;

    const itemId = sourcePort.itemId;
    const itemName = game.items.find(i => i.id === itemId)?.name || itemId;

    // 1. Find compatible existing ports
    const compatibleExisting = useMemo(() => {
        const results: { nodeId: string; portId: string; nodeName: string }[] = [];

        nodes.forEach(node => {
            if (node.id === activePort.nodeId) return;

            const targetPorts = activePort.type === 'input'
                ? node.data.outputPorts
                : node.data.inputPorts;

            targetPorts.forEach(port => {
                if (port.itemId === itemId) {
                    // Check if already connected
                    const isOccupied = edges.some(e =>
                        (e.target === node.id && e.targetHandle === port.id) ||
                        (e.source === node.id && e.sourceHandle === port.id)
                    );

                    if (!isOccupied) {
                        results.push({
                            nodeId: node.id,
                            portId: port.id,
                            nodeName: node.data.name
                        });
                    }
                }
            });
        });

        return results;
    }, [nodes, edges, activePort, itemId]);

    // 2. Find compatible recipes for creation
    const compatibleRecipes = useMemo(() => {
        return game.recipes.filter(recipe => {
            if (activePort.type === 'input') {
                return recipe.outputs.some(o => o.itemId === itemId);
            } else {
                return recipe.inputs.some(i => i.itemId === itemId);
            }
        });
    }, [game.recipes, activePort.type, itemId]);

    const handleConnectExisting = (targetNodeId: string, targetPortId: string) => {
        if (activePort.type === 'output') {
            onConnect({
                source: activePort.nodeId,
                sourceHandle: activePort.portId,
                target: targetNodeId,
                targetHandle: targetPortId
            });
        } else {
            onConnect({
                source: targetNodeId,
                sourceHandle: targetPortId,
                target: activePort.nodeId,
                targetHandle: activePort.portId
            });
        }
        onCancel();
    };

    const handleCreateNew = (recipe: Recipe) => {
        const offsetX = activePort.type === 'output' ? 350 : -350;
        const pos = { x: sourceNode.position.x + offsetX, y: sourceNode.position.y };
        useLayoutStore.getState().createAndConnect(recipe.id, pos, activePort);
        onCancel();
    };


    return (
        <div className="flex flex-col h-full bg-slate-900 text-white rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-blue-400 uppercase tracking-tight">
                        Smart Connect: {itemName}
                    </h2>
                    <p className="text-xs text-slate-400">
                        {activePort.type === 'output' ? 'Find a consumer' : 'Find a producer'}
                    </p>
                </div>
                <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
                    ✕
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* Existing Connections */}
                <section>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Connect to Existing</h3>
                    {compatibleExisting.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {compatibleExisting.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleConnectExisting(item.nodeId, item.portId)}
                                    className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-800 transition-all text-left"
                                >
                                    <span className="font-medium">{item.nodeName}</span>
                                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Port: {item.portId}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 italic px-1">No compatible empty ports found on canvas.</p>
                    )}
                </section>

                {/* New Block Creation */}
                <section>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Create New Producer/Consumer</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {compatibleRecipes.map(recipe => (
                            <button
                                key={recipe.id}
                                onClick={() => handleCreateNew(recipe)}
                                className="flex flex-col p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-green-500 hover:bg-slate-800 transition-all text-left group"
                            >
                                <div className="flex justify-between items-center w-full">
                                    <span className="font-bold text-slate-200 group-hover:text-white">{recipe.name}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">{recipe.category}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                    {recipe.craftingTime}s crafting time
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
