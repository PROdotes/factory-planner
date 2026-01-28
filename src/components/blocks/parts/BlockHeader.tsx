import { Settings, Edit2, Trash2 } from 'lucide-react';
import { memo, useRef, useEffect } from 'react';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { useGameStore } from '@/stores/gameStore';

interface BlockHeaderProps {
    id: string;
    recipeId?: string; // Add recipeId to props
    label: string;
    subLabel: string;
    targetRate: number;
    calculationMode: 'output' | 'machines';
    hasConflict: boolean;
    selected: boolean;
    onDelete: () => void;
    onUpdateRate: (newRate: number) => void;
    height: number;
}

export const BlockHeader = memo(({
    recipeId,
    label,
    subLabel,
    targetRate,
    calculationMode,
    hasConflict,
    selected,
    onDelete,
    onUpdateRate,
    height
}: BlockHeaderProps) => {
    const rateInputRef = useRef<HTMLInputElement>(null);
    const { game } = useGameStore();

    useEffect(() => {
        const target = rateInputRef.current;
        if (!target) return;

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const step = event.shiftKey ? 10 : 1;
            const direction = event.deltaY < 0 ? 1 : -1;
            const currentVal = parseFloat(target.value) || 0;

            const newVal = direction > 0
                ? Math.floor(currentVal + step)
                : Math.ceil(currentVal - step);

            onUpdateRate(Math.max(0, newVal));
        };

        target.addEventListener('wheel', handleWheel, { passive: false });
        return () => target.removeEventListener('wheel', handleWheel);
    }, [onUpdateRate]);

    return (
        <div style={{ height }} className="pt-4 pb-3 px-4 flex justify-between items-center border-b border-slate-900 bg-slate-900/40 rounded-t-lg box-border">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-slate-900/50 border rounded flex items-center justify-center shadow-inner transition-colors overflow-hidden ${hasConflict ? 'border-red-500/30 text-red-500' : 'border-cyan-500/30 text-cyan-400'}`}>
                    {recipeId ? (
                        <DSPIcon index={game.items.find(i => i.id === recipeId)?.iconIndex || 0} size={32} />
                    ) : (
                        <Settings size={20} className={selected && !hasConflict ? 'animate-spin-slow' : ''} />
                    )}
                </div>
                <div>
                    <h2 className="text-slate-50 font-bold text-base leading-none uppercase tracking-wider truncate max-w-[180px]">
                        {label}
                    </h2>
                    <span className={`text-[10px] font-semibold uppercase tracking-widest mt-1 block ${hasConflict ? 'text-red-400/60' : 'text-cyan-400/60'}`}>
                        {subLabel}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right group/input relative">
                    <div className="flex items-baseline gap-1 justify-end relative">
                        <input
                            ref={rateInputRef}
                            type="number"
                            value={targetRate}
                            onChange={(e) => {
                                onUpdateRate(parseFloat(e.target.value) || 0);
                            }}
                            className={`
                                bg-transparent text-xl font-black focus:outline-none w-20 text-right 
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none 
                                nodrag nopan pointer-events-auto transition-all rounded px-1
                                hover:bg-white/5 focus:bg-white/10 cursor-text
                                ${hasConflict ? 'text-red-400' : (calculationMode === 'output' ? 'text-white' : 'text-white/40')}
                            `}
                        />
                        <span className={`text-xs font-bold ${calculationMode === 'output' ? 'text-white/50' : 'text-white/20'}`}>/m</span>
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center justify-end gap-1">
                        {selected && calculationMode === 'output' && <Edit2 size={8} className="text-cyan-400" />}
                        {calculationMode === 'output' ? 'Target Output' : 'Calculated Output'}
                    </div>
                </div>

                {/* Delete Action */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all transition-colors"
                    title="Deconstruct"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
});
