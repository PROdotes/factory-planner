import { memo } from 'react';
import {
    EdgeProps,
    getBezierPath,
    EdgeLabelRenderer,
    BaseEdge,
} from 'reactflow';
import { useLayoutStore } from '@/stores/layoutStore';

import { BeltEdgeData } from '@/types/block';
import { DSP_DATA } from '@/data/dsp';
import { Item } from '@/types/game';

const ConnectionEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    selected,
    data,
}: EdgeProps<BeltEdgeData>) => {
    const deleteEdge = useLayoutStore((state) => state.deleteEdge);
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const edgeData = data as BeltEdgeData;
    const status = edgeData?.status;
    const isOverloaded = status === 'bottleneck' || status === 'overload';
    const isStarved = status === 'underload';
    const hasConflict = isOverloaded || isStarved;

    let strokeColor = '#3b82f6'; // Default cyan
    let strokeDasharray = undefined;

    if (isOverloaded) {
        strokeColor = '#f43f5e'; // Error red
    } else if (isStarved) {
        strokeColor = '#fbbf24'; // Starvation Amber
        strokeDasharray = '6 4';
    }

    if (selected) {
        strokeColor = isOverloaded || isStarved ? strokeColor : '#3b82f6';
    }

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    stroke: strokeColor,
                    strokeWidth: selected ? 3 : 2,
                    strokeDasharray: strokeDasharray,
                    filter: hasConflict
                        ? `drop-shadow(0 0 8px ${strokeColor}66)`
                        : 'none',
                }}
            />

            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan z-[100] flex flex-col items-center gap-2"
                >
                    {/* Flow Rate Label */}
                    {edgeData && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                useLayoutStore.getState().cycleEdgeBelt(id);
                            }}
                            className={`
                                px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-xl shadow-2xl transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95
                                ${isOverloaded
                                    ? 'bg-red-500/10 border-red-500/40 text-red-100 shadow-red-500/10'
                                    : ''}
                                ${isStarved
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-100 shadow-amber-500/10'
                                    : ''}
                                ${!hasConflict
                                    ? 'bg-slate-900/60 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40'
                                    : ''}
                            `}
                            title="Click to cycle belt tier"
                        >
                            <span className="opacity-50">
                                {DSP_DATA.items.find((i: Item) => i.id === edgeData.itemId)?.name || 'Item'}
                            </span>
                            <span className="font-black tabular-nums">
                                {hasConflict
                                    ? `${edgeData.flowRate.toFixed(1)} / ${edgeData.demandRate.toFixed(1)}/m`
                                    : `${edgeData.flowRate.toFixed(1)}/m`
                                }
                            </span>
                            {/* Belt Tier Indicator */}
                            <span className={`
                                ml-1 px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-1 border
                                ${isOverloaded ? 'bg-red-500/20 border-red-500/30 text-red-300' : ''}
                                ${isStarved ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : ''}
                                ${!hasConflict ? 'bg-white/5 border-white/10 text-cyan-400/60' : ''}
                            `}>
                                <span>{edgeData.capacity === 360 ? 'MK1' : (edgeData.capacity === 720 ? 'MK2' : 'MK3')}</span>
                                <span className={hasConflict ? 'text-white' : 'text-cyan-400'}>
                                    ×{Math.ceil(edgeData.demandRate / edgeData.capacity)}
                                </span>
                            </span>
                        </div>
                    )}

                    {selected && (
                        <button
                            className="w-7 h-7 bg-error text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white/20 hover:scale-110 active:scale-95 transition-all"
                            onClick={(event) => {
                                event.stopPropagation();
                                deleteEdge(id);
                            }}
                            title="Sever Link"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default memo(ConnectionEdge);
