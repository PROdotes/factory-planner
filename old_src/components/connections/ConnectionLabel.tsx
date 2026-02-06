
import { memo } from 'react';
import { rateUnitSuffix } from '@/lib/rates';
import { RateUnit } from '@/types/game';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

interface ConnectionLabelProps {
    x: number;
    y: number;
    throughput: number;
    demandRate: number;
    capacity: number;
    rateUnit: RateUnit;
    mainColor: string;
    iconIndex: number;
    flowMode: boolean;
    selected: boolean;
    isVisible: boolean;
    type: 'source' | 'target';
}

export const ConnectionLabel = memo(({
    x,
    y,
    throughput,
    demandRate,
    capacity,
    rateUnit,
    mainColor,
    iconIndex,
    flowMode,
    selected,
    isVisible,
    type
}: ConnectionLabelProps) => {
    if (!isVisible) return null;

    const rateSuffix = rateUnitSuffix(rateUnit);
    const isSource = type === 'source';

    const transform = isSource
        ? `translate(${LAYOUT_METRICS.labels.offsetX}px, ${flowMode ? LAYOUT_METRICS.labels.flowTranslateY : LAYOUT_METRICS.labels.standardTranslateY}) translate(${x}px, ${y - (flowMode ? LAYOUT_METRICS.labels.flowYOffset : LAYOUT_METRICS.labels.standardYOffset)}px)`
        : `translate(calc(-100% - ${LAYOUT_METRICS.labels.offsetX}px), ${flowMode ? LAYOUT_METRICS.labels.flowTranslateY : LAYOUT_METRICS.labels.standardTranslateY}) translate(${x}px, ${y - (flowMode ? LAYOUT_METRICS.labels.flowYOffset : LAYOUT_METRICS.labels.standardYOffset)}px)`;

    const isBottleneck = throughput >= capacity - LAYOUT_METRICS.labels.bottleneckEpsilon;
    const isShortage = demandRate > throughput + LAYOUT_METRICS.labels.shortageEpsilon && !isBottleneck;

    return (
        <div
            style={{
                position: 'absolute',
                transform,
                pointerEvents: 'none',
                padding: `${LAYOUT_METRICS.labels.containerPaddingY}px ${LAYOUT_METRICS.labels.containerPaddingX}px`,
                gap: LAYOUT_METRICS.labels.containerGap
            }}
            className={`
                backdrop-blur-sm border rounded-full flex items-center shadow-2xl z-40 transition-all font-mono
                bg-slate-900/90 border-white/10 whitespace-nowrap
                ${flowMode ? 'scale-[0.8] opacity-100' : (selected ? 'scale-110 border-cyan-500/50' : 'scale-100 opacity-95')}
            `}
        >
            {isSource && (
                <div
                    className="rounded-full"
                    style={{ width: LAYOUT_METRICS.labels.dotSize, height: LAYOUT_METRICS.labels.dotSize, marginLeft: LAYOUT_METRICS.labels.dotMargin, backgroundColor: mainColor }}
                />
            )}

            <div className="flex items-center" style={{ gap: LAYOUT_METRICS.labels.containerGap }}>
                {/* Accented Icon - Large and Pop */}
                <div className="relative flex items-center justify-center" style={{ width: LAYOUT_METRICS.labels.iconWrapSize, height: LAYOUT_METRICS.labels.iconWrapSize }}>
                    <div className={`absolute inset-0 rounded-full blur-md opacity-40 ${isBottleneck ? 'bg-rose-500' : (isShortage ? 'bg-amber-500' : 'bg-cyan-500')}`} />
                    <div className="relative z-10 flex items-center justify-center bg-black/40 rounded-full border border-white/5" style={{ width: LAYOUT_METRICS.labels.iconInnerSize, height: LAYOUT_METRICS.labels.iconInnerSize }}>
                        <DSPIcon index={iconIndex} size={LAYOUT_METRICS.labels.iconSize} />
                    </div>
                </div>

                <div className="flex items-baseline" style={{ gap: 4, marginRight: LAYOUT_METRICS.labels.dotMargin }}>
                    <span className={`font-black tracking-tighter text-white ${!isSource ? 'text-right' : ''}`} style={{ fontSize: LAYOUT_METRICS.labels.rateFontSize }}>
                        {throughput.toFixed(1)}
                    </span>
                    <span className="font-black text-white/30 uppercase tracking-tighter" style={{ fontSize: LAYOUT_METRICS.labels.rateUnitFontSize }}>
                        {rateSuffix}
                    </span>
                </div>


                {isShortage && (
                    <div
                        className="flex items-center border-amber-500/50 bg-amber-500/10 rounded-r-md"
                        style={{ gap: LAYOUT_METRICS.labels.shortageGap, borderLeftWidth: LAYOUT_METRICS.labels.shortageBorderWidth, paddingLeft: LAYOUT_METRICS.labels.shortagePaddingLeft, paddingRight: LAYOUT_METRICS.labels.shortagePaddingRight, marginLeft: LAYOUT_METRICS.labels.shortageMarginLeft, paddingTop: LAYOUT_METRICS.labels.shortagePaddingY, paddingBottom: LAYOUT_METRICS.labels.shortagePaddingY }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={LAYOUT_METRICS.labels.shortageIconSize} height={LAYOUT_METRICS.labels.shortageIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={LAYOUT_METRICS.labels.shortageBorderWidth} className="text-amber-500 animate-pulse">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
                        </svg>
                        <span className="font-black text-amber-400 tracking-tighter" style={{ fontSize: LAYOUT_METRICS.labels.shortageValueFontSize }}>
                            -{(demandRate - throughput).toFixed(0)}
                        </span>
                    </div>
                )}
            </div>

            {!isSource && (
                <div
                    className="rounded-full"
                    style={{ width: LAYOUT_METRICS.labels.dotSize, height: LAYOUT_METRICS.labels.dotSize, marginRight: LAYOUT_METRICS.labels.dotMargin, backgroundColor: mainColor }}
                />
            )}
        </div>
    );
});
