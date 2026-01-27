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
    const flowMode = viewSettings.flowMode;

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
    // In flow mode, always show labels; otherwise respect the toggle
    const showLabels = flowMode || viewSettings.showLabels || selected;

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
                    flowMode={flowMode}
                />
            </g>

            {/* Labels Layer */}
            <EdgeLabelRenderer>
                {/* Source Endpoint Pill */}
                {isVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(12px, -100%) translate(${sourceX}px, ${sourceY - 8}px)`,
                            pointerEvents: 'none',
                        }}
                        className={`
                            backdrop-blur border rounded-full px-2 py-0.5 flex items-center gap-1.5 shadow-xl z-40 transition-all font-mono
                            bg-slate-900 border-white/20 whitespace-nowrap
                            ${selected ? 'scale-110 border-cyan-500/50' : 'scale-90 opacity-90'}
                        `}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mainColor }} />
                        <span className="text-[9px] font-black text-white/90">
                            {throughput.toFixed(1)} {itemName}
                        </span>
                    </div>
                )}

                {/* Target Endpoint Pill */}
                {isVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(calc(-100% - 12px), -100%) translate(${targetX}px, ${targetY - 8}px)`,
                            pointerEvents: 'none',
                        }}
                        className={`
                            backdrop-blur border rounded-full px-2 py-0.5 flex items-center gap-1.5 shadow-xl z-40 transition-all font-mono
                            bg-slate-900 border-white/20 whitespace-nowrap
                            ${selected ? 'scale-110 border-cyan-500/50' : 'scale-90 opacity-90'}
                        `}
                    >
                        <span className="text-[9px] font-black text-white/90 text-right">
                            {throughput.toFixed(1)} {itemName}
                        </span>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mainColor }} />
                    </div>
                )}

                {/* Minimal Selection Overlay (Delete Button + Status) */}
                {selected && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${longest.x}px, ${longest.y}px)`,
                            pointerEvents: 'all',
                        }}
                        className="z-50 flex flex-col items-center gap-2"
                    >
                        <button
                            className="bg-slate-900 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-500 rounded-full p-2 transition-all shadow-2xl scale-125 group"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                deleteEdge(id);
                            }}
                        >
                            <X size={14} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                        </button>

                        {status !== 'ok' && (
                            <div className={`backdrop-blur border rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter shadow-xl ${status === 'underload' ? 'bg-amber-900/40 border-amber-500/50 text-amber-400' : 'bg-rose-900/40 border-rose-500/50 text-rose-400'}`}>
                                {status}
                            </div>
                        )}
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    );
};

export default memo(ConnectionEdge);
