import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';

interface SidebarProps {
    className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
    const { game } = useGameStore();
    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter and group recipes based on search
    const groupedRecipes = useMemo(() => {
        const groups: Record<string, typeof game.recipes> = {};
        const query = searchQuery.toLowerCase();

        game.recipes.forEach(recipe => {
            const matchesSearch = recipe.name.toLowerCase().includes(query) ||
                recipe.category.toLowerCase().includes(query);

            if (matchesSearch) {
                if (!groups[recipe.category]) {
                    groups[recipe.category] = [];
                }
                groups[recipe.category].push(recipe);
            }
        });
        return groups;
    }, [game.recipes, searchQuery]);

    // Live Stats
    const stats = useMemo(() => {
        let totalPower = 0;
        let conflictCount = 0;

        nodes.forEach(node => {
            const data = node.data as any;
            if (data.machineId) {
                const machine = game.machines.find(m => m.id === data.machineId);
                if (machine) {
                    totalPower += data.machineCount * (machine.powerUsage || 0);
                }
            }
        });

        conflictCount = edges.filter(e => e.data?.status && e.data.status !== 'ok').length;

        return {
            totalPower,
            conflictCount,
            isReady: nodes.length > 0 && conflictCount === 0
        };
    }, [nodes, edges, game.machines]);

    const formatPower = (watts: number) => {
        if (watts >= 1000000) return `${(watts / 1000000).toFixed(2)} MW`;
        if (watts >= 1000) return `${(watts / 1000).toFixed(0)} kW`;
        return `${watts.toFixed(0)} W`;
    };

    return (
        <div className={`w-72 bg-surface/40 backdrop-blur-xl border-r border-white/5 flex flex-col ${className}`}>
            <div className="p-6">
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Search system..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 placeholder-textSecondary transition-all"
                    />
                    <div className="absolute right-3 top-3 text-white/20 group-focus-within:text-primary/50 transition-colors">
                        <Search size={16} />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4">
                {/* Logistics Section - Always visible or matches search */}
                {(searchQuery === '' || 'splitter'.toLowerCase().includes(searchQuery.toLowerCase())) && (
                    <div className="space-y-1">
                        <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] px-4 py-2 pt-4 underline underline-offset-4 decoration-primary/20">
                            Logistics
                        </h3>
                        <div className="px-2 space-y-1">
                            <div
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/reactflow', 'splitter');
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                className="px-4 py-3 bg-primary/5 hover:bg-primary/10 cursor-grab active:cursor-grabbing flex items-center justify-between rounded-xl border border-primary/10 hover:border-primary/30 transition-all group"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                                        4-Way Splitter
                                    </span>
                                    <span className="text-[10px] text-textSecondary uppercase tracking-wider">
                                        Modular Logistics
                                    </span>
                                </div>
                                <div className="h-8 w-8 rounded-lg bg-black/20 flex items-center justify-center text-primary border border-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0v4" /><path d="M11 21a2 2 0 1 0 4 0 2 2 0 1 0-4 0" /><path d="M7 21a2 2 0 1 0 4 0 2 2 0 1 0-4 0" /><path d="M11 11v6" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {Object.entries(groupedRecipes).length === 0 && searchQuery !== '' && (
                    <div className="p-8 text-center text-textSecondary text-xs italic">
                        No matches found
                    </div>
                )}

                {Object.entries(groupedRecipes).map(([category, recipes]) => (
                    <div key={category} className="space-y-1">
                        <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] px-4 py-2">
                            {category}
                        </h3>
                        <div className="px-2 space-y-1">
                            {recipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/reactflow', 'new-block');
                                        e.dataTransfer.setData('recipeId', recipe.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    className="px-4 py-3 bg-white/[0.02] hover:bg-white/[0.08] cursor-grab active:cursor-grabbing flex items-center justify-between rounded-xl border border-transparent hover:border-white/10 transition-all group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                                            {recipe.name}
                                        </span>
                                        <span className="text-[10px] text-textSecondary uppercase tracking-wider">
                                            {recipe.machineId.replace(/-/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-black/20 flex items-center justify-center text-[10px] font-bold text-textSecondary border border-white/5">
                                        {recipe.craftingTime}s
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 bg-black/10 border-t border-white/5 space-y-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">Power Grid</span>
                        <span className="text-xs font-black text-cyan-400">{formatPower(stats.totalPower)}</span>
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
