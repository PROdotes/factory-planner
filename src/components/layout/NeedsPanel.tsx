import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { BeltEdgeData } from '@/types/block';
import { DSPIcon } from '@/components/ui/DSPIcon';

interface NeedsPanelProps {
    className?: string;
}

export const NeedsPanel: React.FC<NeedsPanelProps> = ({ className = '' }) => {
    const { game } = useGameStore();
    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const [showTotalInputs, setShowTotalInputs] = useState(false);

    const inputSummary = useMemo(() => {
        const summary = new Map<string, number>();

        nodes.forEach((node) => {
            node.data.inputPorts.forEach((port) => {
                let value;
                if (showTotalInputs) {
                    value = port.rate;
                } else {
                    const incoming = edges
                        .filter((edge) => edge.target === node.id && edge.targetHandle === port.id)
                        .reduce((total, edge) => {
                            const flow = (edge.data as BeltEdgeData | undefined)?.flowRate ?? 0;
                            return total + flow;
                        }, 0);
                    value = Math.max(0, port.rate - incoming);
                }

                if (value > 0.01) {
                    summary.set(port.itemId, (summary.get(port.itemId) || 0) + value);
                }
            });
        });

        return Array.from(summary.entries())
            .map(([itemId, rate]) => ({
                itemId,
                name: game.items.find((item) => item.id === itemId)?.name || itemId,
                rate
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [nodes, edges, game.items, showTotalInputs]);

    const netOutputs = useMemo(() => {
        const outputs = new Map<string, number>();

        nodes.forEach((node) => {
            node.data.outputPorts.forEach((port) => {
                const outgoing = edges
                    .filter((edge) => edge.source === node.id && edge.sourceHandle === port.id)
                    .reduce((total, edge) => {
                        const flow = (edge.data as BeltEdgeData | undefined)?.flowRate ?? 0;
                        return total + flow;
                    }, 0);

                const excess = Math.max(0, port.rate - outgoing);
                if (excess > 0.01) {
                    outputs.set(port.itemId, (outputs.get(port.itemId) || 0) + excess);
                }
            });
        });

        return Array.from(outputs.entries())
            .map(([itemId, rate]) => ({
                itemId,
                name: game.items.find((item) => item.id === itemId)?.name || itemId,
                rate
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [nodes, edges, game.items]);

    const buildingBom = useMemo(() => {
        const counts = new Map<string, number>();
        nodes.forEach(node => {
            const data = node.data as any;
            if (data.machineId) {
                counts.set(data.machineId, (counts.get(data.machineId) || 0) + data.machineCount);
            }
        });

        return Array.from(counts.entries()).map(([machineId, count]) => ({
            id: machineId,
            name: game.machines.find(m => m.id === machineId)?.name || machineId,
            count: Math.ceil(count)
        })).sort((a, b) => b.count - a.count);
    }, [nodes, game.machines]);

    const formatRate = (rate: number) => `${rate.toFixed(1)}/m`;

    return (
        <div className={`w-72 bg-surface/40 backdrop-blur-xl border-l border-white/5 flex flex-col ${className}`}>
            {/* Inputs Section */}
            <div className="flex-none p-6 pb-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                        Consumption
                    </div>
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
                        <button
                            onClick={() => setShowTotalInputs(false)}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${!showTotalInputs ? 'bg-amber-500/20 text-amber-500 shadow-sm' : 'text-white/30 hover:text-white/60'}`}
                        >
                            UNMET
                        </button>
                        <button
                            onClick={() => setShowTotalInputs(true)}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${showTotalInputs ? 'bg-primary/20 text-primary shadow-sm' : 'text-white/30 hover:text-white/60'}`}
                        >
                            TOTAL
                        </button>
                    </div>
                </div>
                <div className="text-sm font-semibold text-text">
                    {showTotalInputs ? 'Total factory blueprint demand' : 'Missing items for current belts'}
                </div>
            </div>

            <div className="flex-none max-h-[35%] overflow-y-auto custom-scrollbar px-4 py-4 border-b border-white/5 bg-white/[0.01]">
                {inputSummary.length === 0 ? (
                    <div className="p-4 text-center text-textSecondary text-xs italic">
                        {showTotalInputs ? 'Empty factory' : 'All inputs connected'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {inputSummary.map((item) => (
                            <div
                                key={item.itemId}
                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5 bg-white/[0.03]"
                            >
                                <div className="flex items-center gap-3">
                                    <DSPIcon index={game.items.find(i => i.id === item.itemId)?.iconIndex || 0} size={20} />
                                    <span className="text-xs font-semibold text-text truncate max-w-[120px]">
                                        {item.name}
                                    </span>
                                </div>
                                <span className={`text-xs font-black ${showTotalInputs ? 'text-primary' : 'text-amber-400'}`}>
                                    {formatRate(item.rate)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Net Outputs Section */}
            <div className="flex-none p-6 border-b border-white/5 mt-2">
                <div className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.3em]">
                    Net Production
                </div>
                <div className="text-sm font-semibold text-text mt-2">
                    Final exports of the factory
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 border-b border-white/5">
                {netOutputs.length === 0 ? (
                    <div className="p-4 text-center text-textSecondary text-xs italic">
                        No final products detected
                    </div>
                ) : (
                    <div className="space-y-2">
                        {netOutputs.map((item) => (
                            <div
                                key={item.itemId}
                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03]"
                            >
                                <div className="flex items-center gap-3">
                                    <DSPIcon index={game.items.find(i => i.id === item.itemId)?.iconIndex || 0} size={20} />
                                    <span className="text-xs font-semibold text-text truncate max-w-[120px]">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="text-xs font-black text-emerald-400">
                                    {formatRate(item.rate)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Buildings Needed Section */}
            <div className="flex-none p-6 border-b border-white/5 mt-2">
                <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                    Buildings Needed
                </div>
                <div className="text-sm font-semibold text-text mt-2">
                    Total machine count for BOM
                </div>
            </div>

            <div className="flex-none max-h-[25%] overflow-y-auto custom-scrollbar px-4 py-4 bg-white/[0.01]">
                {buildingBom.length === 0 ? (
                    <div className="p-4 text-center text-textSecondary text-xs italic">
                        No buildings in layout
                    </div>
                ) : (
                    <div className="space-y-2">
                        {buildingBom.map((machine) => (
                            <div
                                key={machine.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-primary/10 bg-primary/[0.03]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                        {machine.name.charAt(0)}
                                    </div>
                                    <span className="text-xs font-semibold text-text truncate max-w-[120px]">
                                        {machine.name}
                                    </span>
                                </div>
                                <span className="text-xs font-black text-white">
                                    × {machine.count}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
