import { Handle, Position } from 'reactflow';
import { Port, EdgeStatus, BLOCK_LAYOUT, calculateSideLayout } from '@/types/block';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';
import { useLayoutStore } from '@/stores/layoutStore';
import { useGameStore } from '@/stores/gameStore';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { memo } from 'react';

export interface PortState {
    status: EdgeStatus;
    connected: boolean;
}

interface BlockPortListProps {
    ports: Port[];
    side: 'input' | 'output';
    portStates: Record<string, PortState>; // Map portId -> state
    getItemName: (id: string) => string;
    onPortClick: (portId: string) => void;
    primaryOutputId?: string;
    onSetPrimary?: (itemId: string) => void;
}

export const BlockPortList = memo(({
    ports,
    side,
    portStates,
    getItemName,
    onPortClick,
    primaryOutputId,
    onSetPrimary
}: BlockPortListProps) => {
    const { game } = useGameStore();
    const flowMode = useLayoutStore(state => state.viewSettings.flowMode);

    // Unified Source of Truth for Layout
    const layouts = calculateSideLayout(ports, game, flowMode);

    return (
        <div className="relative w-full h-full" style={{ minHeight: BLOCK_LAYOUT.CENTER_BODY_MIN_HEIGHT }}>
            {/* Column Label */}
            <div
                className="absolute top-0 w-full text-center font-black tracking-[0.2em] opacity-20 pointer-events-none uppercase"
                style={{
                    height: BLOCK_LAYOUT.BODY_TOP_PADDING,
                    lineHeight: `${BLOCK_LAYOUT.BODY_TOP_PADDING}px`,
                    fontSize: BLOCK_LAYOUT.FOOTER_TEXT_SIZE,
                    left: 0
                }}
            >
                {side === 'input' ? 'Inputs' : 'Outputs'}
            </div>

            <div className="relative w-full h-full" style={{ marginTop: BLOCK_LAYOUT.BODY_TOP_PADDING }}>

                {layouts.map(({ port, top, height, labelBottomFromTop, lanes }) => {
                    const state = portStates[port.id] || { status: 'ok', connected: false };
                    const item = game.items.find(i => i.id === port.itemId);

                    // Port Diagnostic Math (removed unused variables)

                    const beltHeight = flowMode ? LAYOUT_METRICS.belt.laneHeight.flow : LAYOUT_METRICS.belt.laneHeight.standard;
                    const beltStackHeight = lanes * beltHeight;

                    // Calculate belt stack visual position (centered)
                    const beltStackTop = (height / 2) - (beltStackHeight / 2);

                    return (
                        <div
                            key={port.id}
                            className="absolute w-full group/port"
                            style={{ top, height }}
                        >
                            {/* THE INTERACTIVE HANDLE (Full Size, Behind Content) */}
                            <Handle
                                type={side === 'input' ? 'target' : 'source'}
                                position={side === 'input' ? Position.Left : Position.Right}
                                id={port.id}
                                className="!absolute !inset-0 !min-w-full !min-h-full opacity-0 z-40 cursor-pointer"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onPortClick(port.id);
                                }}
                            />

                            {/* VISUAL LAYER */}
                            <div className="absolute inset-0 pointer-events-none z-10 transition-all duration-200">
                                {/* Standard Pod Frame (The Box) */}
                                <div
                                    className={`
                                    absolute inset-0 rounded border-2 transition-colors duration-200
                                    ${state.connected ? 'bg-slate-900/80 border-cyan-500/50' : 'bg-slate-900/40 border-slate-700/50'}
                                `}
                                />

                                {/* BELT STACK VISUALIZATION (The "Stripes") */}
                                <div
                                    className="absolute left-0 w-full flex flex-col items-center justify-center opacity-30"
                                    style={{
                                        top: beltStackTop,
                                        height: beltStackHeight,
                                        gap: BLOCK_LAYOUT.BELT_STRIPE_GAP
                                    }}
                                >
                                    {Array.from({ length: lanes }).map((_, i) => (
                                        <div key={i} className="w-full bg-cyan-500/20" style={{ height: beltHeight - BLOCK_LAYOUT.BELT_STRIPE_GAP }} />
                                    ))}
                                </div>

                                {/* LABEL GROUP (Icon, Status, Name) - Pushed up by Belts */}
                                <div
                                    className="absolute left-0 w-full flex flex-col justify-end"
                                    style={{
                                        height: BLOCK_LAYOUT.LABEL_GROUP_HEIGHT,
                                        bottom: height - labelBottomFromTop,
                                        paddingLeft: BLOCK_LAYOUT.LABEL_GROUP_PADDING_X,
                                        paddingRight: BLOCK_LAYOUT.LABEL_GROUP_PADDING_X
                                    }}
                                >
                                    <div className={`flex items-start justify-between w-full ${side === 'input' ? 'flex-row' : 'flex-row-reverse'}`}>
                                        <DSPIcon index={item?.iconIndex || 0} size={BLOCK_LAYOUT.LABEL_ICON_SIZE} />
                                    </div>
                                    <div className="text-center font-black uppercase tracking-tighter opacity-40 truncate" style={{ fontSize: BLOCK_LAYOUT.LABEL_NAME_FONT_SIZE, lineHeight: `${BLOCK_LAYOUT.LABEL_NAME_LINE_HEIGHT}px` }}>
                                        {getItemName(port.itemId)}
                                    </div>
                                </div>

                                {/* TRUTH FRACTION (Anchored Bottom) */}
                                <div className="absolute bottom-1 w-full text-center">
                                    <div className={`font-bold leading-none ${state.connected ? 'text-white' : 'text-white/30'}`} style={{ fontSize: BLOCK_LAYOUT.LABEL_TRUTH_MAIN_FONT_SIZE }}>
                                        {port.rate.toFixed(1)}
                                    </div>
                                </div>
                            </div>

                            {/* Primary Output Toggle (Floating) */}
                            {side === 'output' && ports.length > 1 && onSetPrimary && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSetPrimary(port.itemId);
                                    }}
                                    className={`
                                    absolute top-1 right-1 rounded z-50 pointer-events-auto
                                    ${primaryOutputId === port.itemId ? 'text-yellow-400' : 'text-slate-700 hover:text-slate-400'}
                                `}
                                    style={{ padding: BLOCK_LAYOUT.PRIMARY_TOGGLE_PADDING }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width={BLOCK_LAYOUT.PRIMARY_TOGGLE_ICON_SIZE} height={BLOCK_LAYOUT.PRIMARY_TOGGLE_ICON_SIZE} viewBox="0 0 24 24" fill={primaryOutputId === port.itemId ? "currentColor" : "none"} stroke="currentColor" strokeWidth={BLOCK_LAYOUT.PRIMARY_TOGGLE_STROKE_WIDTH}>
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
