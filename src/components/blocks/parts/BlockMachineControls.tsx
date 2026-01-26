import { ChevronDown, FlaskConical } from 'lucide-react';
import { memo } from 'react';

export interface ModifierState {
    type: 'speed' | 'productivity' | 'none';
    level: number;
    includeConsumption: boolean;
}

interface BlockMachineControlsProps {
    machineName: string;
    hasAlternatives: boolean;
    onCycleMachine: () => void;

    modifier?: ModifierState;
    onUpdateModifier: (mod?: ModifierState) => void;
}

export const BlockMachineControls = memo(({
    machineName,
    hasAlternatives,
    onCycleMachine,
    modifier,
    onUpdateModifier
}: BlockMachineControlsProps) => {

    return (
        <div className="px-4 py-2 bg-slate-900/20 border-b border-slate-900/50 flex items-center justify-between gap-2">

            {/* Machine Selection (Left) */}
            <div className="flex-1 flex items-center justify-between pr-2 border-r border-slate-800/50">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest hidden sm:inline">Machine</span>

                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasAlternatives) onCycleMachine();
                    }}
                    className={`
                        text-[10px] font-bold py-0.5 px-2 rounded border border-transparent transition-all flex items-center gap-1
                        ${hasAlternatives ? 'cursor-pointer hover:bg-slate-800 hover:border-cyan-500/30 text-cyan-400 bg-slate-900 shadow-sm' : 'text-slate-400'}
                    `}
                >
                    <span className="truncate max-w-[200px]">{machineName}</span>
                    {hasAlternatives && <ChevronDown size={10} className="text-cyan-500/50" />}
                </div>
            </div>

            {/* Modifier Selection (Right) */}
            <div className="flex items-center gap-1">
                {/* Level Cycle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const currentLevel = modifier?.level || 0;
                        const nextLevel = (currentLevel + 1) % 4;

                        onUpdateModifier(nextLevel === 0 ? undefined : {
                            type: modifier?.type || 'speed',
                            level: nextLevel,
                            includeConsumption: true
                        });
                    }}
                    className={`
                        p-1 rounded flex items-center justify-center transition-all border
                        ${(modifier?.level || 0) > 0
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'}
                    `}
                    title="Proliferator Level (Mk.I / II / III)"
                >
                    <FlaskConical size={12} fill={(modifier?.level || 0) > 0 ? "currentColor" : "none"} />
                    {(modifier?.level || 0) > 0 && <span className="text-[9px] font-black ml-1">Mk.{modifier.level}</span>}
                </button>

                {/* Type Toggle (Only if Level > 0) */}
                {(modifier?.level || 0) > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const newType = modifier?.type === 'speed' ? 'productivity' : 'speed';
                            onUpdateModifier({ ...modifier!, type: newType });
                        }}
                        className={`
                            text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-all
                            ${modifier?.type === 'productivity'
                                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'}
                        `}
                        title={modifier?.type === 'productivity' ? "Extra Products" : "Speedup"}
                    >
                        {modifier?.type === 'productivity' ? 'Prod' : 'Speed'}
                    </button>
                )}
            </div>
        </div>
    );
});
