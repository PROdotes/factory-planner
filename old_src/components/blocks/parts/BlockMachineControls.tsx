import { ChevronDown, FlaskConical } from 'lucide-react';
import { memo } from 'react';

import { ModifierState } from '@/types/block';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

interface BlockMachineControlsProps {
    machineName: string;
    hasAlternatives: boolean;
    onCycleMachine: () => void;

    modifier?: ModifierState;
    onUpdateModifier: (mod?: ModifierState) => void;
    height: number;
}

export const BlockMachineControls = memo(({
    machineName,
    hasAlternatives,
    onCycleMachine,
    modifier,
    onUpdateModifier,
    height
}: BlockMachineControlsProps) => {

    return (
        <div style={{ height, paddingLeft: LAYOUT_METRICS.block.controls.paddingX, paddingRight: LAYOUT_METRICS.block.controls.paddingX }} className="bg-slate-900/20 border-b border-slate-900/50 flex items-center justify-between box-border">

            {/* Modifier Selection (Left) */}
            <div className="flex items-center" style={{ gap: LAYOUT_METRICS.block.controls.modifierGap }}>
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
                        rounded flex items-center justify-center transition-all border
                        ${(modifier?.level || 0) > 0
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'}
                    `}
                    style={{ padding: LAYOUT_METRICS.block.controls.buttonPadding }}
                    title="Proliferator Level (Mk.I / II / III)"
                >
                    <FlaskConical size={LAYOUT_METRICS.block.controls.iconSize} fill={(modifier?.level || 0) > 0 ? "currentColor" : "none"} />
                    {(modifier?.level || 0) > 0 && <span className="font-black" style={{ fontSize: LAYOUT_METRICS.block.controls.modifierTextSize, marginLeft: LAYOUT_METRICS.block.controls.modifierGap }}>Mk.{modifier?.level}</span>}
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
                            font-bold uppercase rounded border transition-all
                            ${modifier?.type === 'productivity'
                                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'}
                        `}
                        style={{ fontSize: LAYOUT_METRICS.block.controls.modifierTextSize, paddingLeft: LAYOUT_METRICS.block.controls.modifierTextPaddingX, paddingRight: LAYOUT_METRICS.block.controls.modifierTextPaddingX, paddingTop: LAYOUT_METRICS.block.controls.modifierTextPaddingY, paddingBottom: LAYOUT_METRICS.block.controls.modifierTextPaddingY }}
                        title={modifier?.type === 'productivity' ? "Extra Products" : "Speedup"}
                    >
                        {modifier?.type === 'productivity' ? 'Prod' : 'Speed'}
                    </button>
                )}
            </div>

            {/* Machine Selection (Right) */}
            <div className="flex-1 flex items-center justify-end" style={{ gap: LAYOUT_METRICS.block.controls.gap }}>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasAlternatives) onCycleMachine();
                    }}
                    className={`
                        font-bold rounded border border-transparent transition-all flex items-center
                         ${hasAlternatives ? 'cursor-pointer hover:bg-slate-800 hover:border-cyan-500/30 text-cyan-400 bg-slate-900 shadow-sm' : 'text-slate-400'}
                    `}
                    style={{ fontSize: LAYOUT_METRICS.block.controls.machineTextSize, paddingLeft: LAYOUT_METRICS.block.controls.machinePaddingX, paddingRight: LAYOUT_METRICS.block.controls.machinePaddingX, paddingTop: LAYOUT_METRICS.block.controls.machinePaddingY, paddingBottom: LAYOUT_METRICS.block.controls.machinePaddingY, gap: LAYOUT_METRICS.block.controls.modifierGap }}
                >
                    <span className="truncate text-right" style={{ maxWidth: LAYOUT_METRICS.block.controls.machineMaxWidth }}>{machineName}</span>
                    {hasAlternatives && <ChevronDown size={LAYOUT_METRICS.block.controls.chevronSize} className="text-cyan-500/50" />}
                </div>
            </div>
        </div>
    );
});
