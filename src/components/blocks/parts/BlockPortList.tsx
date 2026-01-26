import { Handle, Position } from 'reactflow';
import { Port, EdgeStatus, BLOCK_LAYOUT } from '@/types/block';
import { memo } from 'react';

export interface PortState {
    status: EdgeStatus;
    connected: boolean;
}

interface BlockPortListProps {
    ports: Port[];
    side: 'input' | 'output';
    nodeId: string;
    portStates: Record<string, PortState>; // Map portId -> state
    getItemName: (id: string) => string;
    onPortClick: (portId: string) => void;
    primaryOutputId?: string;
    onSetPrimary?: (itemId: string) => void;
}

export const BlockPortList = memo(({
    ports,
    side,
    nodeId,
    portStates,
    getItemName,
    onPortClick,
    primaryOutputId,
    onSetPrimary
}: BlockPortListProps) => {

    return (
        <div className="relative w-full h-full">
            <span
                style={{ height: BLOCK_LAYOUT.PORT_LABEL }}
                className={`absolute top-0 w-full text-[9px] text-slate-500 font-black uppercase tracking-tighter pb-1 flex items-end pointer-events-none ${side === 'output' ? 'justify-end' : ''}`}
            >
                {side === 'input' ? 'Inputs' : 'Outputs'}
            </span>
            {ports.map((port, index) => {
                const state = portStates[port.id] || { status: 'ok', connected: false };
                const isOverloaded = state.status === 'bottleneck' || state.status === 'overload';
                const isStarved = state.status === 'underload';
                const hasConflict = isOverloaded || isStarved;

                const conflictColor = isOverloaded ? 'rgba(239,68,68,1)' : (isStarved ? 'rgba(251,191,36,1)' : 'rgba(6,182,212,0.5)');
                const conflictBg = isOverloaded ? 'rgba(239,68,68,0.1)' : (isStarved ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)');

                const itemTop = BLOCK_LAYOUT.PORT_LABEL + (index * (BLOCK_LAYOUT.PORT_ROW + BLOCK_LAYOUT.PORT_GAP));

                return (
                    <div
                        key={port.id}
                        className="absolute w-full group/port"
                        style={{ top: itemTop, height: BLOCK_LAYOUT.PORT_ROW }}
                    >
                        <Handle
                            type={side === 'input' ? 'target' : 'source'}
                            position={side === 'input' ? Position.Left : Position.Right}
                            id={port.id}
                            style={{
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                minWidth: '100%',
                                minHeight: '100%',
                                background: conflictBg,
                                borderRadius: '0.25rem',
                                border: 'none',
                                [side === 'input' ? 'borderLeft' : 'borderRight']: `2px solid ${hasConflict ? conflictColor : 'rgba(51,65,85,1)'}`,
                                transform: 'none'
                            }}
                            className={`
                                !absolute !inset-0 z-50 cursor-pointer
                                flex flex-col px-2 py-1.5 transition-all duration-200
                                ${side === 'input' ? 'items-start' : 'items-end'}
                                ${!hasConflict ? 'hover:border-cyan-400 hover:bg-cyan-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]' : ''}
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                onPortClick(port.id);
                            }}
                        >
                            <div className={`flex items-center gap-1 mb-0.5 pointer-events-none ${side === 'output' ? 'justify-end' : ''} w-full`}>
                                {side === 'output' && ports.length > 1 && onSetPrimary && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSetPrimary(port.itemId);
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className={`
                                            p-0.5 rounded hover:bg-white/10 transition-colors z-[60] relative pointer-events-auto
                                            ${primaryOutputId === port.itemId ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400/50'}
                                        `}
                                        title="Set as Primary Output"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill={primaryOutputId === port.itemId ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </button>
                                )}
                                <span className={`text-[9px] truncate leading-tight pointer-events-none ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-slate-400')}`}>
                                    {getItemName(port.itemId)}
                                </span>
                            </div>
                            <span className={`text-[11px] font-bold leading-tight pointer-events-none ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-cyan-200/80')}`}>
                                {port.rate.toFixed(1)}
                            </span>
                        </Handle>
                    </div>
                );
            })}
        </div>
    );
});
