
import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { useNeedsSummary } from '@/hooks/useNeedsSummary';
import { useFactoryStats } from '@/hooks/useFactoryStats';

interface NeedsPanelProps {
    className?: string;
}

export const NeedsPanel: React.FC<NeedsPanelProps> = ({ className = '' }) => {
    const { game } = useGameStore();
    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const [showTotalInputs, setShowTotalInputs] = useState(false);

    const { inputSummary, netOutputs, buildingBom, formatRate } = useNeedsSummary(
        nodes,
        edges,
        game.items,
        game.machines,
        showTotalInputs,
        game.settings.rateUnit
    );

    // Live Stats
    const stats = useFactoryStats(nodes, edges, game.machines);

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

            <div className="flex-1 min-h-[120px] overflow-y-auto custom-scrollbar px-4 py-4 border-b border-white/5 bg-white/[0.01]">
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

            <div className="flex-1 min-h-[120px] overflow-y-auto custom-scrollbar px-4 py-4 border-b border-white/5">
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

            <div className="flex-none max-h-[30%] overflow-y-auto custom-scrollbar px-4 py-4 bg-white/[0.01]">
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


            {/* Factory Stats Section */}
            <div className="p-6 bg-black/10 border-t border-white/5 space-y-4 flex-none">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Metadata</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-white/50 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-tighter">v{game.version}</span>
                            <button
                                onClick={() => useGameStore.getState().resetToDefault()}
                                className="text-[9px] font-black text-primary hover:text-white uppercase tracking-tighter hover:underline"
                            >
                                Sync Data
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Power Grid</span>
                        <span className="text-xs font-black text-cyan-400">{stats.formatPower(stats.totalPower)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Buildings</span>
                        <span className="text-xs font-black text-white">{stats.machineCount} Total</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Flow Integrity</span>
                        {stats.conflictCount > 0 ? (
                            <span className="text-xs font-black text-red-500 flex items-center gap-1">
                                <AlertTriangle size={12} /> {stats.conflictCount} ISSUES
                            </span>
                        ) : (
                            <span className="text-xs font-black text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 size={12} /> OPTIMAL
                            </span>
                        )}
                    </div>
                </div>

                <div className={`
                    p-3 border rounded-xl transition-all duration-500
                    ${stats.conflictCount > 0
                        ? 'bg-red-500/5 border-red-500/20'
                        : (nodes.length > 0 ? 'bg-emerald-500/5 border-emerald-500/20 animate-pulse' : 'bg-white/5 border-white/5')}
                `}>
                    <p className={`text-[11px] leading-relaxed font-bold uppercase tracking-tight text-center ${stats.conflictCount > 0 ? 'text-red-400' : (nodes.length > 0 ? 'text-emerald-400' : 'text-slate-500')}`}>
                        {stats.conflictCount > 0
                            ? 'Infrastructure in critical state'
                            : (nodes.length > 0 ? 'Production link confirmed' : 'No active production')}
                    </p>
                </div>
            </div>
        </div>
    );
};
