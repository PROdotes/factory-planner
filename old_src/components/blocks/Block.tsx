import { memo, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Block as BlockType, BLOCK_LAYOUT, BLOCK_FLOW_LAYOUT, getFlowPortLayouts, getCalculatedSize, Port } from '@/types/block';
import { useLayoutStore } from '@/stores/layoutStore';
import { useGameStore } from '@/stores/gameStore';
import { Zap, Activity, Factory, ArrowRight, Trash2 } from 'lucide-react';
import { useBlockMetrics } from '@/hooks/useBlockMetrics';

import { rateUnitSuffix } from '@/lib/rates';
import { BlockHeader } from './parts/BlockHeader';
import { BlockMachineControls } from './parts/BlockMachineControls';
import { BlockPortList } from './parts/BlockPortList';
import { BlockDetailModal } from './BlockDetailModal';

const Block = ({ id, data, selected }: NodeProps<BlockType>) => {
    const { game } = useGameStore();
    const deleteBlock = useLayoutStore((state) => state.deleteBlock);
    const updateBlock = useLayoutStore((state) => state.updateBlock);
    const edges = useLayoutStore((state) => state.edges);
    const onPortClick = useLayoutStore((state) => state.onPortClick);
    const flowMode = useLayoutStore((state) => state.viewSettings.flowMode);
    const machineInputRef = useRef<HTMLInputElement>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Lookup data for display
    const recipe = game.recipes.find(r => r.id === data.recipeId);
    const getMachineName = (mid: string) => game.machines.find(m => m.id === mid)?.name || 'Unknown';
    const currentMachine = game.machines.find(m => m.id === data.machineId);

    const { totalPowerWatts, hasConflict, portStates, getItemName, formatPower } = useBlockMetrics(
        id,
        data,
        edges,
        game.machines,
        game.items
    );

    // Handlers
    const handleUpdateRate = useCallback((newRate: number) => updateBlock(id, {
        targetRate: newRate,
        calculationMode: 'output'
    }), [id, updateBlock]);

    const handleUpdateMachineCount = useCallback((count: number) => updateBlock(id, {
        targetMachineCount: count,
        calculationMode: 'machines'
    }), [id, updateBlock]);

    const handleDelete = useCallback(() => deleteBlock(id), [id, deleteBlock]);

    // Machine Logic
    const alternatives = useMemo(() => {
        return game.machines.filter(m =>
            currentMachine &&
            m.category === currentMachine.category &&
            m.id !== currentMachine.id
        );
    }, [game.machines, currentMachine]);

    const handleCycleMachine = useCallback(() => {
        if (alternatives.length === 0) return;
        const allInCategory = game.machines.filter(m =>
            currentMachine && m.category === currentMachine.category
        );
        const currentIndex = allInCategory.findIndex(m => m.id === data.machineId);
        const nextIndex = (currentIndex + 1) % allInCategory.length;
        const nextMachine = allInCategory[nextIndex];

        updateBlock(id, { machineId: nextMachine.id });
    }, [alternatives, currentMachine, game.machines, data.machineId, id, updateBlock]);

    const handleUpdateModifier = useCallback((mod?: BlockType['modifier']) => updateBlock(id, { modifier: mod }), [id, updateBlock]);

    useEffect(() => {
        const target = machineInputRef.current;
        if (!target) return;

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const step = event.shiftKey ? BLOCK_LAYOUT.CENTER_MACHINE_STEP_SHIFT : BLOCK_LAYOUT.CENTER_MACHINE_STEP;
            const direction = event.deltaY < 0 ? 1 : -1;
            const currentVal = data.calculationMode === 'machines'
                ? (data.targetMachineCount ?? data.machineCount)
                : data.machineCount;

            const newVal = Math.round(currentVal + (direction * step));
            handleUpdateMachineCount(Math.max(0, newVal));
        };

        target.addEventListener('wheel', handleWheel, { passive: false });
        return () => target.removeEventListener('wheel', handleWheel);
    }, [data.calculationMode, data.machineCount, data.targetMachineCount, handleUpdateMachineCount]);

    const handlePortClick = useCallback((pid: string) => {
        if (data.inputPorts.some((p: Port) => p.id === pid)) {
            onPortClick(id, pid, 'input');
            return;
        }
        if (data.outputPorts.some((p: Port) => p.id === pid)) {
            onPortClick(id, pid, 'output');
            return;
        }
    }, [data.inputPorts, data.outputPorts, id, onPortClick]);

    const handleSetPrimary = useCallback((itemId: string) => updateBlock(id, { primaryOutputId: itemId }), [id, updateBlock]);

    // Get the primary output item for the badge icon color
    const primaryOutput = data.outputPorts[0];
    const primaryItem = primaryOutput ? game.items.find(i => i.id === primaryOutput.itemId) : null;
    const badgeColor = primaryItem?.color || '#64748b';

    // Single source of truth: always compute size from LAYOUT_METRICS
    const computedSize = getCalculatedSize(data, flowMode, game);

    // ═══════════════════════════════════════════════════════════════════════════
    // FLOW MODE: Compact Badge Rendering
    // ═══════════════════════════════════════════════════════════════════════════
    if (flowMode) {
        const badgeWidth = computedSize.width;
        const badgeHeight = computedSize.height;

        // Removed unused lane count variables

        return (
            <>
                <div
                    style={{ width: badgeWidth, height: badgeHeight }}
                    className={`
                        flex flex-col items-center justify-center
                        bg-slate-900/90 backdrop-blur-sm border rounded-lg shadow-lg font-mono relative
                        cursor-pointer transition-all duration-200
                        ${selected ? 'border-cyan-500 ring-2 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'border-slate-700 hover:border-slate-500'}
                        ${hasConflict ? 'border-red-500/70' : ''}
                    `}
                    onClick={() => setShowDetailModal(true)}
                >
                    {/* Accent bar */}
                    <div
                        className="absolute top-0 left-0 w-full rounded-t-lg"
                        style={{ backgroundColor: badgeColor, height: BLOCK_LAYOUT.FLOW_BADGE_ACCENT_HEIGHT }}
                    />

                    {/* Recipe Icon + Count */}
                    <div className="flex flex-col items-center" style={{ gap: BLOCK_LAYOUT.FLOW_BADGE_ROW_GAP }}>
                        <div className="flex items-center" style={{ gap: BLOCK_LAYOUT.FLOW_BADGE_GAP }}>
                            <Factory size={BLOCK_LAYOUT.FLOW_BADGE_ICON_SIZE} style={{ color: badgeColor }} />
                            <span className="text-white font-black" style={{ fontSize: BLOCK_LAYOUT.FLOW_BADGE_COUNT_FONT_SIZE }}>
                                ×{Math.ceil(data.machineCount)}
                            </span>
                        </div>
                        {primaryItem && (
                            <img
                                src={`https://dsp-wiki.com/images/thumb/${primaryItem.name.replace(/ /g, '_')}.png/32px-${primaryItem.name.replace(/ /g, '_')}.png`}
                                className="opacity-80"
                                style={{ width: BLOCK_LAYOUT.FLOW_BADGE_ITEM_ICON_SIZE, height: BLOCK_LAYOUT.FLOW_BADGE_ITEM_ICON_SIZE, opacity: BLOCK_LAYOUT.FLOW_BADGE_ICON_OPACITY }}
                                alt={primaryItem.name}
                                onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement | null;
                                    if (img) img.style.display = 'none';
                                }}
                            />
                        )}
                    </div>

                    {/* Output Rate */}
                    <div className="text-slate-400 font-bold" style={{ fontSize: BLOCK_LAYOUT.FLOW_BADGE_OUTPUT_FONT_SIZE }}>
                        {data.actualRate.toFixed(0)}{rateUnitSuffix(game.settings.rateUnit)}
                    </div>

                    {/* Precision-aligned ports in Flow Mode */}
                    {(['left', 'right', 'top', 'bottom'] as Array<'left' | 'right' | 'top' | 'bottom'>).flatMap((side) => {
                        const sidePorts = [...data.inputPorts, ...data.outputPorts].filter(p => p.side === side);
                        const sideLayouts = getFlowPortLayouts(data, game).filter((layout) => layout.side === side);

                        return sidePorts.map((port) => {
                            const portLayouts = sideLayouts.filter((layout) => layout.id === port.id);
                            if (portLayouts.length === 0) return null;

                            const isInput = port.type === 'input';
                            const position = side === 'left' ? Position.Left : side === 'right' ? Position.Right : side === 'top' ? Position.Top : Position.Bottom;

                            // Find the geometric center of this port's lanes
                            const first = portLayouts[0];
                            const last = portLayouts[portLayouts.length - 1];
                            const bundleCenter = (first.offsetInBundle + last.offsetInBundle) / 2;

                            const containerStyle: React.CSSProperties = {
                                position: 'absolute',
                                [side === 'left' ? 'left' : side === 'right' ? 'right' : side === 'top' ? 'top' : 'bottom']: -BLOCK_FLOW_LAYOUT.HANDLE_SIZE / 2,
                                [side === 'left' || side === 'right' ? 'top' : 'left']: bundleCenter,
                                transform: side === 'left' || side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)',
                                pointerEvents: 'none'
                            };

                            return (
                                <div key={port.id} style={containerStyle} className="z-50 flex flex-col items-center justify-center">
                                    {/* Visual dots for each lane */}
                                    {portLayouts.map((layout) => (
                                        <div
                                            key={`${port.id}-dot-${layout.laneIdx}`}
                                            className="rounded-full shadow-lg"
                                            style={{
                                                width: BLOCK_FLOW_LAYOUT.HANDLE_SIZE,
                                                height: BLOCK_FLOW_LAYOUT.HANDLE_SIZE,
                                                background: isInput ? '#06b6d4' : '#fbbf24',
                                                border: `${BLOCK_LAYOUT.FLOW_BADGE_DOT_BORDER}px solid rgba(15, 23, 42, 0.8)`,
                                                marginBottom: (side === 'left' || side === 'right') && layout.laneIdx < portLayouts.length - 1 ? (BLOCK_FLOW_LAYOUT.LANE_SPACING - BLOCK_FLOW_LAYOUT.HANDLE_SIZE) : 0,
                                                marginRight: (side === 'top' || side === 'bottom') && layout.laneIdx < portLayouts.length - 1 ? (BLOCK_FLOW_LAYOUT.LANE_SPACING - BLOCK_FLOW_LAYOUT.HANDLE_SIZE) : 0,
                                                boxShadow: BLOCK_LAYOUT.FLOW_BADGE_DOT_SHADOW
                                            }}
                                        />
                                    ))}

                                    {/* The Single Master Handle (Invisible but active) */}
                                    <Handle
                                        type={isInput ? "target" : "source"}
                                        position={position}
                                        id={port.id}
                                        className="!opacity-0 !w-full !h-full !absolute pointer-events-auto cursor-pointer"
                                        style={{ border: 'none', background: 'transparent' }}
                                    />
                                </div>
                            );
                        });
                    })}
                </div>

                {/* Detail Modal */}
                {showDetailModal && (
                    <BlockDetailModal
                        data={data}
                        recipe={recipe}
                        machine={currentMachine}
                        totalPower={totalPowerWatts}
                        hasConflict={hasConflict}
                        onClose={() => setShowDetailModal(false)}
                        onUpdateRate={handleUpdateRate}
                        onUpdateMachineCount={handleUpdateMachineCount}
                        onCycleMachine={handleCycleMachine}
                        onUpdateModifier={handleUpdateModifier}
                        onDelete={handleDelete}
                        formatPower={formatPower}
                        getItemName={getItemName}
                    />
                )}
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STANDARD MODE: Full Block Rendering
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div
            style={{ width: computedSize.width, minHeight: computedSize.height }}
            className={`
                h-auto flex flex-col
                bg-slate-950 border rounded-lg shadow-2xl font-mono relative group transition-all duration-300
                ${selected ? 'border-cyan-500 ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]' : 'border-slate-800 hover:border-slate-700'}
                ${hasConflict && !selected ? 'border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}
            `}
        >
            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full rounded-t-lg bg-gradient-to-r ${hasConflict ? 'from-red-600 to-red-400' : (selected ? 'from-cyan-400 to-blue-500' : 'from-slate-700 to-slate-800')}`} style={{ height: BLOCK_LAYOUT.ACCENT_BAR_HEIGHT }}></div>

            {/* HEADER SECTION: Strict Height Enforcement */}
            <div style={{ height: BLOCK_LAYOUT.HEADER }} className="flex flex-col flex-none relative z-10">
                <BlockHeader
                    id={id}
                    recipeId={data.recipeId}
                    label={data.name}
                    subLabel={data.machineId ? getMachineName(data.machineId) : 'Custom Block'}
                    targetRate={data.targetRate}
                    actualRate={data.outputPorts[0]?.currentRate ?? data.actualRate}
                    targetDemand={data.outputPorts[0]?.targetDemand || 0}
                    calculationMode={data.calculationMode}
                    hasConflict={hasConflict}
                    selected={selected}
                    onUpdateRate={handleUpdateRate}
                    height={BLOCK_LAYOUT.HEADER_TOP_HEIGHT}
                />

                <BlockMachineControls
                    machineName={currentMachine?.name || 'Unknown'}
                    hasAlternatives={alternatives.length > 0}
                    onCycleMachine={handleCycleMachine}
                    modifier={data.modifier}
                    onUpdateModifier={handleUpdateModifier}
                    height={BLOCK_LAYOUT.HEADER_CONTROLS_HEIGHT}
                />
            </div>

            {/* BODY SECTION: The Core Factory Math */}
            <div
                className="flex-1 grid items-stretch relative box-border"
                style={{
                    padding: BLOCK_LAYOUT.PADDING,
                    gridTemplateColumns: `${BLOCK_LAYOUT.PORT_COLUMN_WIDTH}px minmax(${BLOCK_LAYOUT.CENTER_MIN_WIDTH}px, 1fr) ${BLOCK_LAYOUT.PORT_COLUMN_WIDTH}px`,
                    gap: BLOCK_LAYOUT.BODY_GRID_GAP
                }}
            >
                <BlockPortList
                    ports={data.inputPorts}
                    side="input"
                    portStates={portStates}
                    getItemName={getItemName}
                    onPortClick={handlePortClick}
                />

                {/* CENTER: THE MACHINE MATH */}
                <div className="relative w-full h-full" style={{ minHeight: BLOCK_LAYOUT.CENTER_BODY_MIN_HEIGHT }}>
                    {/* Column Label */}
                    <div
                        className="absolute top-0 w-full text-center font-black tracking-[0.2em] opacity-20 pointer-events-none uppercase"
                        style={{
                            height: BLOCK_LAYOUT.BODY_TOP_PADDING,
                            lineHeight: `${BLOCK_LAYOUT.BODY_TOP_PADDING}px`,
                            fontSize: BLOCK_LAYOUT.FOOTER_TEXT_SIZE,
                        }}
                    >
                        Process
                    </div>

                    <div className="relative w-full h-full" style={{ marginTop: BLOCK_LAYOUT.BODY_TOP_PADDING }}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-40 text-slate-900/50">
                            <ArrowRight size={BLOCK_LAYOUT.CENTER_ARROW_SIZE} strokeWidth={BLOCK_LAYOUT.CENTER_ARROW_STROKE} />
                        </div>

                        <div
                            className={`
                            relative mx-auto w-fit pointer-events-auto
                            bg-slate-900 border rounded text-center shadow-lg transition-all group-hover:border-cyan-500/20
                            ${data.calculationMode === 'machines' ? 'border-cyan-500/50' : 'border-slate-800'}
                        `}
                            style={{ paddingLeft: BLOCK_LAYOUT.CENTER_BADGE_PADDING_X, paddingRight: BLOCK_LAYOUT.CENTER_BADGE_PADDING_X, paddingTop: BLOCK_LAYOUT.CENTER_BADGE_PADDING_Y, paddingBottom: BLOCK_LAYOUT.CENTER_BADGE_PADDING_Y }}
                        >
                            <div className={`uppercase font-black tracking-widest transition-colors ${data.calculationMode === 'machines' ? 'text-cyan-500' : 'text-slate-500'}`} style={{ fontSize: BLOCK_LAYOUT.CENTER_BADGE_LABEL_SIZE, marginBottom: BLOCK_LAYOUT.CENTER_BADGE_LABEL_MARGIN }}>
                                {data.calculationMode === 'machines' ? 'Fixed' : 'Needed'}
                            </div>
                            <div className="flex items-baseline justify-center">
                                <input
                                    ref={machineInputRef}
                                    type="number"
                                    step={BLOCK_LAYOUT.CENTER_MACHINE_STEP}
                                    value={data.calculationMode === 'machines' ? (data.targetMachineCount ?? data.machineCount) : data.machineCount.toFixed(1)}
                                    onChange={(e) => {
                                        handleUpdateMachineCount(parseFloat(e.target.value) || 0);
                                    }}
                                    className={`
                                    bg-transparent font-black focus:outline-none text-center
                                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                    nodrag nopan nowheel pointer-events-auto transition-all rounded overflow-hidden
                                    hover:bg-white/5 focus:bg-white/10 cursor-text
                                    ${data.calculationMode === 'machines' ? 'text-white' : 'text-white/60'}
                                `}
                                    style={{ MozAppearance: 'textfield', width: BLOCK_LAYOUT.CENTER_MACHINE_INPUT_WIDTH, fontSize: BLOCK_LAYOUT.CENTER_MACHINE_FONT_SIZE }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <BlockPortList
                    ports={data.outputPorts}
                    side="output"
                    portStates={portStates}
                    getItemName={getItemName}
                    onPortClick={handlePortClick}
                    primaryOutputId={data.primaryOutputId}
                    onSetPrimary={handleSetPrimary}
                />
            </div>

            <div
                style={{ height: BLOCK_LAYOUT.FOOTER, paddingLeft: BLOCK_LAYOUT.FOOTER_PADDING_X, paddingRight: BLOCK_LAYOUT.FOOTER_PADDING_X, fontSize: BLOCK_LAYOUT.FOOTER_TEXT_SIZE }}
                className="mt-auto bg-slate-950/80 border-t border-slate-900 rounded-b-lg flex justify-between items-center font-bold text-slate-500 tracking-wider box-border"
            >
                <div className="flex" style={{ gap: BLOCK_LAYOUT.FOOTER_GAP }}>
                    <span className="flex items-center hover:text-yellow-500 transition-colors" style={{ gap: BLOCK_LAYOUT.FOOTER_BUTTON_GAP }}>
                        <Zap size={BLOCK_LAYOUT.FOOTER_ICON_SIZE} /> {formatPower(totalPowerWatts)}
                    </span>
                    <span className={`flex items-center transition-colors ${hasConflict ? 'text-red-500 animate-pulse' : 'hover:text-emerald-500'}`} style={{ gap: BLOCK_LAYOUT.FOOTER_BUTTON_GAP }}>
                        <Activity size={BLOCK_LAYOUT.FOOTER_ICON_SIZE} /> {hasConflict ? 'FLOW CONFLICT' : '100% EFFICIENCY'}
                    </span>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                    }}
                    className="flex items-center text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all transition-colors pointer-events-auto nodrag uppercase"
                    style={{ gap: BLOCK_LAYOUT.FOOTER_BUTTON_GAP, paddingLeft: BLOCK_LAYOUT.FOOTER_BUTTON_PADDING_X, paddingRight: BLOCK_LAYOUT.FOOTER_BUTTON_PADDING_X, paddingTop: BLOCK_LAYOUT.FOOTER_BUTTON_PADDING_Y, paddingBottom: BLOCK_LAYOUT.FOOTER_BUTTON_PADDING_Y }}
                    title="Deconstruct"
                >
                    <Trash2 size={BLOCK_LAYOUT.FOOTER_ICON_SIZE} />
                    <span>Deconstruct</span>
                </button>
            </div>
        </div>
    );
};

export default memo(Block);
