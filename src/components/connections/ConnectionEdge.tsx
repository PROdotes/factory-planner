import { memo, useState } from 'react';
import {
    EdgeProps,
    EdgeLabelRenderer,
    BaseEdge,
} from 'reactflow';
import { X } from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useGameStore } from '@/stores/gameStore';
import { ChannelRenderer } from '@/components/connections/ChannelRenderer';
import { Point } from '@/lib/router/channelRouter';

const ConnectionEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    selected,
    data: edgeData,
}: EdgeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { deleteEdge, viewSettings } = useLayoutStore();
    const getItem = useGameStore(state => state.getItem);

    const item = edgeData?.itemId ? getItem(edgeData.itemId) : null;
    const itemName = item?.name || 'Any';
    const itemCategory = item?.category || 'other';
    const status = edgeData?.status || 'ok';
    const throughput = edgeData?.flowRate || 0;
    const capacity = edgeData?.capacity || 60; // Default MK1 if not set

    // Item-Specific or Categorical Colors (Tracing logic)
    const getCategoryColor = () => {
        if (status === 'conflict') return '#f43f5e'; // Red for ERROR overrides everything
        if (status === 'mismatch') return '#a855f7'; // Purple for logic error
        if (status === 'overload') return '#ef4444'; // Solid Red for overload
        if (status === 'underload') return '#fbbf24'; // Amber for starvation

        // 1. High-priority Item color (from dsp.ts)
        if (item?.color) return item.color;

        // 2. Fallback to broad categories
        switch (itemCategory) {
            case 'ore': return '#64748b';    // Raw Slate
            case 'ingot': return '#b45309';  // Amber/Copper
            case 'component': return '#2563eb'; // Deep Blue
            case 'product': return '#059669'; // Emerald
            case 'science': return '#0891b2'; // Science Cyan
            case 'fluid': return '#9333ea';  // Purple
            default: return '#334155';
        }
    };

    const mainColor = getCategoryColor();
    const showLabels = viewSettings.showLabels || selected;

    // Fixed Manhattan Path (Z-shape)
    const midX = sourceX + (targetX - sourceX) * 0.5;
    const points: Point[] = [
        { x: sourceX, y: sourceY },
        { x: midX, y: sourceY },
        { x: midX, y: targetY },
        { x: targetX, y: targetY }
    ];

    // Calculate Longest Segment for Label Positioning
    const segments = [
        { x: (sourceX + midX) / 2, y: sourceY, len: Math.abs(midX - sourceX), vertical: false },
        { x: midX, y: (sourceY + targetY) / 2, len: Math.abs(targetY - sourceY), vertical: true },
        { x: (midX + targetX) / 2, y: targetY, len: Math.abs(targetX - midX), vertical: false }
    ];
    const longest = segments.reduce((prev, current) => (prev.len > current.len) ? prev : current);

    // Show labels if global toggle is ON, OR if interacting (hover/select)
    const isVisible = showLabels || isHovered || selected;

    const lanes = viewSettings.bundleLanes ? 1 : Math.ceil(throughput / capacity);
    const bWidth = (lanes - 1) * 6 + 12;

    return (
        <>
            {/* The actual clickable path (invisible but captures events) */}
            <g
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <BaseEdge
                    id={id}
                    path={`M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`}
                    style={{
                        strokeWidth: Math.max(20, bWidth),
                        stroke: 'transparent',
                        cursor: 'pointer'
                    }}
                />
            </g>

            {/* The Visual Ribbon */}
            <g style={{ pointerEvents: 'none' }}>
                <ChannelRenderer
                    points={points}
                    throughput={throughput}
                    beltCapacity={capacity}
                    color={mainColor}
                    isSelected={selected}
                    showFlow={viewSettings.showFlow}
                    bundleLanes={viewSettings.bundleLanes}
                    status={status}
                    pattern={status === 'conflict' ? 'conflict' : undefined}
                />
            </g>

            {/* Status Tooltip / Info - Hover Only */}
            {isVisible && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${longest.x}px, ${longest.y}px)`,
                            pointerEvents: selected ? 'all' : 'none',
                        }}
                        className={`
                            backdrop-blur border rounded-lg p-1.5 flex flex-col gap-0.5 min-w-[80px] shadow-2xl z-50 transition-all
                            ${selected ? 'bg-slate-900/90 border-slate-500 scale-110' : 'bg-slate-950/60 border-white/10 scale-90 opacity-80'}
                        `}
                    >
                        {selected && (
                            <button
                                className="absolute -top-3 -right-3 text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-700 rounded-full p-1 transition-colors shadow-lg cursor-pointer pointer-events-auto"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    deleteEdge(id);
                                }}
                            >
                                <X size={10} strokeWidth={3} />
                            </button>
                        )}
                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-black tracking-widest ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                                {itemName}
                            </span>
                            <div className="flex items-baseline gap-0.5">
                                <span className={`text-[11px] font-black ${status === 'underload' ? 'text-amber-400' : (selected ? 'text-cyan-400' : 'text-white/60')}`}>
                                    {throughput.toFixed(1)}
                                </span>
                                {edgeData?.demandRate && Math.abs(edgeData.demandRate - throughput) > 0.05 && (
                                    <>
                                        <span className="text-[10px] text-white/20">/</span>
                                        <span className="text-[10px] font-bold text-white/40">
                                            {edgeData.demandRate.toFixed(1)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {selected && status !== 'ok' && (
                            <div className={`mt-0.5 pt-0.5 border-t border-white/5 text-[8px] font-black uppercase tracking-tighter text-center ${status === 'underload' ? 'text-amber-400' : 'text-rose-400'}`}>
                                STATUS: {status}
                            </div>
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

export default memo(ConnectionEdge);
