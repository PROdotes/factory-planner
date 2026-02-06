
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
import { ConnectionLabel } from '@/components/connections/ConnectionLabel';
import { Point } from '@/lib/router/channelRouter';
import { getCategoryColor } from '@/lib/ui/edgeStyles';
import { defaultBeltCapacity } from '@/lib/rates';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

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
    const rateUnit = useGameStore(state => state.game.settings.rateUnit);
    const flowMode = viewSettings.flowMode;

    const item = edgeData?.itemId ? getItem(edgeData.itemId) : null;
    const status = edgeData?.status || 'ok';
    const throughput = edgeData?.flowRate || 0;
    const capacity = edgeData?.capacity || defaultBeltCapacity(rateUnit);

    const mainColor = getCategoryColor(status, item?.color, item?.category);
    // In flow mode, always show labels; otherwise respect the toggle
    const showLabels = flowMode || viewSettings.showLabels || selected;

    // Use calculated points if available, otherwise fallback to simple Z-shape
    const midX = sourceX + (targetX - sourceX) * 0.5;
    let points: Point[] = edgeData?.points ? [...edgeData.points] : [
        { x: sourceX, y: sourceY },
        { x: midX, y: sourceY },
        { x: midX, y: targetY },
        { x: targetX, y: targetY }
    ];

    // STRETCHING LOGIC: Snap the ends to the handles ONLY during interaction/dragging.
    if (points.length < 2 || !edgeData?.points) {
        if (points.length >= 2) {
            points[0] = { x: sourceX, y: sourceY };
            points[points.length - 1] = { x: targetX, y: targetY };
        }
    }

    const pathD = points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ');

    // Calculate Longest Segment for Label Positioning (Delete button)
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        segments.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, len });
    }
    const longest = segments.length > 0
        ? segments.reduce((prev, current) => (prev.len > current.len) ? prev : current)
        : { x: midX, y: (sourceY + targetY) / 2 };

    const isVisible = showLabels || isHovered || selected;
    const lanes = viewSettings.bundleLanes ? 1 : Math.max(1, Math.ceil(throughput / capacity));
    const bWidth = (lanes - 1) * LAYOUT_METRICS.belt.standardLaneSpacing
        + LAYOUT_METRICS.belt.standardFoundationBase
        + LAYOUT_METRICS.belt.standardFoundationPadding;

    return (
        <>
            {/* The actual clickable path */}
            <g
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <BaseEdge
                    id={id}
                    path={pathD}
                    style={{
                        strokeWidth: Math.max(LAYOUT_METRICS.belt.clickableStrokeMin, bWidth),
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
                    flowMode={flowMode}
                />
            </g>

            {/* Labels Layer */}
            <EdgeLabelRenderer>
                <ConnectionLabel
                    type="source"
                    x={sourceX}
                    y={sourceY}
                    throughput={throughput}
                    demandRate={edgeData.demandRate || 0}
                    capacity={capacity}
                    iconIndex={item?.iconIndex || 0}
                    rateUnit={rateUnit}
                    mainColor={mainColor}
                    flowMode={Boolean(flowMode)}
                    selected={Boolean(selected)}
                    isVisible={Boolean(isVisible)}
                />

                <ConnectionLabel
                    type="target"
                    x={targetX}
                    y={targetY}
                    throughput={throughput}
                    demandRate={edgeData.demandRate || 0}
                    capacity={capacity}
                    iconIndex={item?.iconIndex || 0}
                    rateUnit={rateUnit}
                    mainColor={mainColor}
                    flowMode={Boolean(flowMode)}
                    selected={Boolean(selected)}
                    isVisible={Boolean(isVisible)}
                />

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
