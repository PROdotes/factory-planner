import { memo } from 'react';
import {
    EdgeProps,
    EdgeLabelRenderer,
    BaseEdge,
} from 'reactflow';
import { X } from 'lucide-react';
import { getChannelSegments } from '@/lib/validation/conflictDetection';
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
    sourceHandleId,
    targetHandleId,
    selected,
    data: edgeData,
}: EdgeProps) => {
    const deleteEdge = useLayoutStore(state => state.deleteEdge);
    const getItem = useGameStore(state => state.getItem);
    const itemName = edgeData?.itemId && edgeData.itemId !== 'any' ? (getItem(edgeData.itemId)?.name || edgeData.itemId) : 'Any';
    const status = edgeData?.status || 'ok';
    const throughput = edgeData?.flowRate || 60;
    const capacity = edgeData?.capacity || 300; // Match default

    // Line colors based on status
    const getColors = () => {
        switch (status) {
            case 'conflict': return { main: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' };
            case 'bottleneck':
            case 'overload': return { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' };
            case 'underload': return { main: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' };
            case 'mismatch': return { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' };
            default: return { main: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' };
        }
    };

    const colors = getColors();
    const mainColor = colors.main;

    // Fixed Manhattan Path (Z-shape)
    const midX = sourceX + (targetX - sourceX) * 0.5;
    const points: Point[] = [
        { x: sourceX, y: sourceY },
        { x: midX, y: sourceY },
        { x: midX, y: targetY },
        { x: targetX, y: targetY }
    ];

    const lanes = Math.ceil(throughput / capacity);
    const bWidth = (lanes - 1) * 6 + 12;

    return (
        <>
            {/* The actual clickable path (invisible but captures events) */}
            <BaseEdge
                id={id}
                path={`M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`}
                style={{
                    strokeWidth: Math.max(20, bWidth),
                    stroke: 'transparent',
                    cursor: 'pointer'
                }}
            />

            {/* The Visual Ribbon */}
            <g style={{ pointerEvents: 'none' }}>
                <ChannelRenderer
                    points={points}
                    throughput={throughput}
                    beltCapacity={capacity}
                    color={mainColor}
                    isSelected={selected}
                    pattern={status === 'conflict' ? 'conflict' : undefined}
                />

                {/* DEBUG COLLISION SEGMENTS (LIME)
                {getChannelSegments(points, bWidth).map((rect, i) => (
                    <rect
                        key={`segment-${i}`}
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        fill="rgba(132, 204, 22, 0.2)"
                        stroke="#84cc16"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        className="z-[500]"
                    />
                ))}
                */}
            </g>

            {/* Status Tooltip / Info */}
            {selected && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${midX}px, ${(sourceY + targetY) / 2}px)`,
                            pointerEvents: 'all',
                        }}
                        className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-2 flex flex-col gap-1 min-w-[120px] shadow-2xl z-50 relative"
                    >
                        <button
                            className="absolute -top-3 -right-3 text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-700 rounded-full p-1 transition-colors shadow-lg cursor-pointer pointer-events-auto"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                deleteEdge(id);
                            }}
                        >
                            <X size={12} strokeWidth={3} />
                        </button>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Flow</span>
                            <span className="text-xs font-black text-cyan-400">{throughput.toFixed(1)}/min</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Type</span>
                            <span className="text-xs font-black text-slate-300">{itemName}</span>
                        </div>
                        {status !== 'ok' && (
                            <div className={`mt-1 pt-1 border-t border-white/5 text-[9px] font-black uppercase tracking-tighter text-center ${status === 'underload' ? 'text-amber-400' : 'text-rose-400'}`}>
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
