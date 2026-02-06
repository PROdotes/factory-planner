import { Settings, Edit2 } from 'lucide-react';
import { memo, useRef, useEffect } from 'react';
import { rateUnitSuffix } from '@/lib/rates';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { useGameStore } from '@/stores/gameStore';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

interface BlockHeaderProps {
    id: string;
    recipeId?: string;
    label: string;
    subLabel: string;
    targetRate: number;
    actualRate: number;
    targetDemand: number;
    calculationMode: 'output' | 'machines';
    hasConflict: boolean;
    selected: boolean;
    onUpdateRate: (newRate: number) => void;
    height: number;
}

export const BlockHeader = memo(({
    recipeId,
    label,
    subLabel,
    targetRate,
    actualRate,
    targetDemand,
    calculationMode,
    hasConflict,
    selected,
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

            const step = event.shiftKey ? LAYOUT_METRICS.block.header.rateStepShift : LAYOUT_METRICS.block.header.rateStep;
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

    // Satisfaction levels
    const downstreamDemand = Math.max(targetDemand, targetRate);
    const satisfaction = downstreamDemand > 0 ? actualRate / downstreamDemand : 1;
    const isUnderPerforming = actualRate < targetRate - LAYOUT_METRICS.block.header.rateEpsilon;
    const isUnderDemanded = actualRate < targetDemand - LAYOUT_METRICS.block.header.rateEpsilon;

    return (
        <div
            style={{ height, paddingTop: LAYOUT_METRICS.block.header.paddingTop, paddingBottom: LAYOUT_METRICS.block.header.paddingBottom, paddingLeft: LAYOUT_METRICS.block.header.paddingX, paddingRight: LAYOUT_METRICS.block.header.paddingX }}
            className="relative flex justify-between items-center border-b border-slate-900 bg-slate-900/40 rounded-t-lg box-border overflow-hidden"
        >
            {/* Background Satisfaction Gauge */}
            <div
                className={`absolute inset-0 opacity-10 transition-all duration-1000 ${isUnderDemanded ? 'bg-amber-500' : 'bg-cyan-500'}`}
                style={{ width: `${Math.min(100, satisfaction * 100)}%` }}
            />

            <div className="flex items-center relative z-10 shrink-0" style={{ gap: LAYOUT_METRICS.block.header.textGap }}>
                <div
                    className={`bg-slate-900/50 border rounded flex items-center justify-center shadow-inner transition-colors overflow-hidden ${hasConflict ? 'border-red-500/30 text-red-500' : 'border-cyan-500/30 text-cyan-400'}`}
                    style={{ width: LAYOUT_METRICS.block.header.iconWrapSize, height: LAYOUT_METRICS.block.header.iconWrapSize }}
                >
                    {recipeId ? (
                        <DSPIcon index={game.items.find(i => i.id === recipeId)?.iconIndex || 0} size={LAYOUT_METRICS.block.header.iconSize} />
                    ) : (
                        <Settings size={LAYOUT_METRICS.block.header.settingsIconSize} className={selected && !hasConflict ? 'animate-spin-slow' : ''} />
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <h2 className="text-slate-50 font-bold leading-none uppercase tracking-wider truncate" style={{ fontSize: LAYOUT_METRICS.block.header.titleFontSize, maxWidth: LAYOUT_METRICS.block.header.titleMaxWidth }}>
                        {label}
                    </h2>
                    <span
                        className={`font-semibold uppercase tracking-widest block truncate ${hasConflict ? 'text-red-400/60' : 'text-cyan-400/60'}`}
                        style={{ fontSize: LAYOUT_METRICS.block.header.subtitleFontSize, marginTop: LAYOUT_METRICS.block.header.subtitleMarginTop, maxWidth: LAYOUT_METRICS.block.header.subtitleMaxWidth }}
                    >
                        {subLabel}
                    </span>
                </div>
            </div>

            <div className="flex items-center relative z-10" style={{ gap: LAYOUT_METRICS.block.header.rateGap }}>
                <div className="text-right group/input relative">
                    <div className="flex flex-col items-end">
                        <div className="flex items-baseline justify-end relative" style={{ gap: LAYOUT_METRICS.block.header.rateUnitGap }}>
                            <input
                                ref={rateInputRef}
                                type="number"
                                value={targetRate}
                                onChange={(e) => {
                                    onUpdateRate(parseFloat(e.target.value) || 0);
                                }}
                                className={`
                                    bg-transparent font-black focus:outline-none text-right 
                                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none 
                                    nodrag nopan nowheel pointer-events-auto transition-all rounded
                                    hover:bg-white/5 focus:bg-white/10 cursor-text
                                    ${hasConflict ? 'text-red-400' : (calculationMode === 'output' ? 'text-white' : 'text-white/40')}
                                `}
                                style={{ width: LAYOUT_METRICS.block.header.rateInputWidth, fontSize: LAYOUT_METRICS.block.header.rateInputFontSize, paddingLeft: LAYOUT_METRICS.block.header.rateInputPaddingX, paddingRight: LAYOUT_METRICS.block.header.rateInputPaddingX }}
                            />
                            <span className={`font-bold ${calculationMode === 'output' ? 'text-white/50' : 'text-white/20'}`} style={{ fontSize: LAYOUT_METRICS.block.header.rateUnitFontSize }}>
                                {rateUnitSuffix(game.settings.rateUnit)}
                            </span>
                        </div>

                        {/* THE REALITY LABEL: Shown ONLY when it doesn't match the target */}

                        {isUnderPerforming && (
                            <div className="flex items-center" style={{ gap: LAYOUT_METRICS.block.header.actualGap, marginTop: LAYOUT_METRICS.block.header.demandMarginTop }}>
                                <span className="font-black text-amber-500 animate-pulse uppercase" style={{ fontSize: LAYOUT_METRICS.block.header.actualFontSize }}>
                                    Actual: {actualRate.toFixed(1)}
                                </span>
                                {targetDemand > targetRate + 0.1 && (
                                    <div className="font-black text-amber-500/40 uppercase tracking-tighter border-l border-white/10" style={{ fontSize: LAYOUT_METRICS.block.header.demandFontSize, paddingLeft: LAYOUT_METRICS.block.header.demandPaddingLeft }}>
                                        Wanted: {targetDemand.toFixed(0)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* If not underperforming but we have a high request, show demand */}
                        {!isUnderPerforming && targetDemand > targetRate + 0.1 && (
                            <div className="font-black text-amber-500/40 uppercase tracking-tighter" style={{ fontSize: LAYOUT_METRICS.block.header.demandFontSize, marginTop: LAYOUT_METRICS.block.header.demandMarginTop }}>
                                Demand: {targetDemand.toFixed(0)}
                            </div>
                        )}
                    </div>
                    <div className="text-slate-500 uppercase tracking-widest font-black flex items-center justify-end" style={{ fontSize: LAYOUT_METRICS.block.header.hintFontSize, gap: LAYOUT_METRICS.block.header.hintIconSize, marginTop: LAYOUT_METRICS.block.header.hintMarginTop }}>
                        {selected && calculationMode === 'output' && <Edit2 size={LAYOUT_METRICS.block.header.hintIconSize} className="text-cyan-400" />}
                        {calculationMode === 'output' ? 'User Target' : 'System Calc'}
                    </div>
                </div>
            </div>
        </div>
    );
});
