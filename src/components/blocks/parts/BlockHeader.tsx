import { Settings, Edit2, Trash2 } from 'lucide-react';
import { memo } from 'react';

interface BlockHeaderProps {
    id: string;
    label: string;
    subLabel: string;
    targetRate: number;
    hasConflict: boolean;
    selected: boolean;
    onDelete: () => void;
    onUpdateRate: (newRate: number) => void;
}

export const BlockHeader = memo(({
    label,
    subLabel,
    targetRate,
    hasConflict,
    selected,
    onDelete,
    onUpdateRate
}: BlockHeaderProps) => {

    return (
        <div className="p-4 flex justify-between items-center border-b border-slate-900 bg-slate-900/40 rounded-t-lg">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-slate-900/50 border rounded flex items-center justify-center shadow-inner transition-colors ${hasConflict ? 'border-red-500/30 text-red-500' : 'border-cyan-500/30 text-cyan-400'}`}>
                    <Settings size={20} className={selected && !hasConflict ? 'animate-spin-slow' : ''} />
                </div>
                <div>
                    <h2 className="text-slate-50 font-bold text-base leading-none uppercase tracking-wider truncate max-w-[150px]">
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
                            type="number"
                            value={targetRate}
                            onChange={(e) => {
                                onUpdateRate(parseFloat(e.target.value) || 0);
                            }}
                            onFocus={(e) => {
                                // Add minor event listener fix for chrome/edge scroll behavior
                                const target = e.target as HTMLInputElement;
                                const handleWheel = (event: WheelEvent) => {
                                    if (document.activeElement === target) {
                                        event.preventDefault();
                                        event.stopPropagation(); // Trap the event completely

                                        const step = event.shiftKey ? 10 : 1;
                                        const direction = event.deltaY < 0 ? 1 : -1;

                                        // We get the current value from the target value string
                                        // because closures might capture an old 'data.targetRate'
                                        const currentVal = parseFloat(target.value) || 0;
                                        const newVal = Math.max(0, currentVal + (direction * step));

                                        onUpdateRate(newVal);
                                    }
                                };
                                // Registering with { passive: false } is required to allow preventDefault() in Chrome
                                target.addEventListener('wheel', handleWheel, { passive: false });
                                (target as any)._wheelFixed = handleWheel;
                            }}
                            onBlur={(e) => {
                                const target = e.target as HTMLInputElement;
                                if ((target as any)._wheelFixed) {
                                    target.removeEventListener('wheel', (target as any)._wheelFixed);
                                }
                            }}
                            className={`
                                bg-transparent text-xl font-black focus:outline-none w-20 text-right 
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none 
                                nodrag nopan pointer-events-auto transition-all rounded px-1
                                hover:bg-white/5 focus:bg-white/10 cursor-text
                                ${hasConflict ? 'text-red-400' : 'text-white'}
                            `}
                        />
                        <span className="text-xs font-bold text-white/50">/m</span>
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center justify-end gap-1">
                        {selected && <Edit2 size={8} className="text-cyan-400" />}
                        Target Output
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
