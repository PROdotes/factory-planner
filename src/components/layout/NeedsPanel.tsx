import React, { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { BeltEdgeData } from '@/types/block';

interface NeedsPanelProps {
    className?: string;
}

export const NeedsPanel: React.FC<NeedsPanelProps> = ({ className = '' }) => {
    const { game } = useGameStore();
    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);

    const unmetItems = useMemo(() => {
        const unmet = new Map<string, number>();

        nodes.forEach((node) => {
            node.data.inputPorts.forEach((port) => {
                const incoming = edges
                    .filter((edge) => edge.target === node.id && edge.targetHandle === port.id)
                    .reduce((total, edge) => {
                        const flow = (edge.data as BeltEdgeData | undefined)?.flowRate ?? 0;
                        return total + flow;
                    }, 0);

                const remaining = Math.max(0, port.rate - incoming);
                if (remaining > 0.01) {
                    unmet.set(port.itemId, (unmet.get(port.itemId) || 0) + remaining);
                }
            });
        });

        return Array.from(unmet.entries())
            .map(([itemId, rate]) => ({
                itemId,
                name: game.items.find((item) => item.id === itemId)?.name || itemId,
                rate
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [nodes, edges, game.items]);

    const formatRate = (rate: number) => `${rate.toFixed(1)}/m`;

    return (
        <div className={`w-72 bg-surface/40 backdrop-blur-xl border-l border-white/5 flex flex-col ${className}`}>
            <div className="p-6 border-b border-white/5">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                    Unmet Inputs
                </div>
                <div className="text-sm font-semibold text-text mt-2">
                    Items still needed to complete lines
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
                {unmetItems.length === 0 ? (
                    <div className="p-4 text-center text-textSecondary text-xs italic">
                        All inputs connected
                    </div>
                ) : (
                    <div className="space-y-2">
                        {unmetItems.map((item) => (
                            <div
                                key={item.itemId}
                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5 bg-white/[0.03]"
                            >
                                <span className="text-xs font-semibold text-text truncate max-w-[140px]">
                                    {item.name}
                                </span>
                                <span className="text-xs font-black text-amber-400">
                                    {formatRate(item.rate)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
