import { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { Block as BlockType, BLOCK_LAYOUT } from '@/types/block';
import { DSP_DATA } from '@/data/dsp';
import { useLayoutStore } from '@/stores/layoutStore';
import { ArrowRight, Activity, Zap } from 'lucide-react';

import { BlockHeader } from './parts/BlockHeader';
import { BlockMachineControls } from './parts/BlockMachineControls';
import { BlockPortList, PortState } from './parts/BlockPortList';

const Block = ({ id, data, selected }: NodeProps<BlockType>) => {
    const deleteBlock = useLayoutStore((state) => state.deleteBlock);
    const updateBlock = useLayoutStore((state) => state.updateBlock);
    const edges = useLayoutStore((state) => state.edges);
    const onPortClick = useLayoutStore((state) => state.onPortClick);
    const machineInputRef = useRef<HTMLInputElement>(null);

    // Lookup data for display
    const recipe = DSP_DATA.recipes.find(r => r.id === data.recipeId);
    const currentMachine = DSP_DATA.machines.find(m => m.id === data.machineId);

    const totalPowerWatts = data.machineCount * (currentMachine?.powerUsage || 0);
    const formatPower = (watts: number) => {
        if (watts >= 1000000) return `${(watts / 1000000).toFixed(2)} MW`;
        if (watts >= 1000) return `${(watts / 1000).toFixed(0)} kW`;
        return `${watts.toFixed(0)} W`;
    };

    const getItemName = (id: string) => {
        return DSP_DATA.items.find(i => i.id === id)?.name || id;
    };

    // Check for conflicts on connected edges & Build Port States
    const { hasConflict, portStates } = useMemo(() => {
        const connectedEdges = edges.filter(e => e.source === id || e.target === id);
        const conflict = connectedEdges.some(e => (e.data?.status === 'bottleneck' || e.data?.status === 'overload' || e.data?.status === 'underload'));

        const keyMap: Record<string, PortState> = {};
        connectedEdges.forEach(e => {
            const status = e.data?.status || 'ok';
            if (e.source === id && e.sourceHandle) {
                keyMap[e.sourceHandle] = { status, connected: true };
            }
            if (e.target === id && e.targetHandle) {
                keyMap[e.targetHandle] = { status, connected: true };
            }
        });

        return { hasConflict: conflict, portStates: keyMap };
    }, [edges, id]);

    // Handlers
    const handleUpdateRate = useCallback((newRate: number) => updateBlock(id, {
        targetRate: newRate,
        calculationMode: 'output'
    }), [id, updateBlock]);

    const handleUpdateMachineCount = useCallback((count: number) => updateBlock(id, {
        targetMachineCount: count,
        calculationMode: 'machines'
    }), [id, updateBlock]);

    useEffect(() => {
        const target = machineInputRef.current;
        if (!target) return;

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const step = event.shiftKey ? 10 : 1;
            const direction = event.deltaY < 0 ? 1 : -1;
            const currentVal = parseFloat(target.value) || 0;

            const newVal = direction > 0
                ? Math.floor(currentVal + step)
                : Math.ceil(currentVal - step);

            handleUpdateMachineCount(Math.max(0, newVal));
        };

        target.addEventListener('wheel', handleWheel, { passive: false });
        return () => target.removeEventListener('wheel', handleWheel);
    }, [handleUpdateMachineCount]);

    const handleDelete = useCallback(() => deleteBlock(id), [id, deleteBlock]);

    // Machine Logic
    const alternatives = useMemo(() => {
        return DSP_DATA.machines.filter(m =>
            currentMachine &&
            m.category === currentMachine.category &&
            m.id !== currentMachine.id
        );
    }, [currentMachine]);

    const handleCycleMachine = useCallback(() => {
        if (alternatives.length === 0) return;
        const allInCategory = DSP_DATA.machines.filter(m =>
            currentMachine && m.category === currentMachine.category
        );
        const currentIndex = allInCategory.findIndex(m => m.id === data.machineId);
        const nextIndex = (currentIndex + 1) % allInCategory.length;
        const nextMachine = allInCategory[nextIndex];

        updateBlock(id, { machineId: nextMachine.id });
    }, [alternatives, currentMachine, data.machineId, id, updateBlock]);

    const handleUpdateModifier = useCallback((mod?: any) => updateBlock(id, { modifier: mod }), [id, updateBlock]);

    const handlePortClick = useCallback((pid: string) => {
        if (data.inputPorts.some(p => p.id === pid)) {
            onPortClick(id, pid, 'input');
            return;
        }
        if (data.outputPorts.some(p => p.id === pid)) {
            onPortClick(id, pid, 'output');
            return;
        }
    }, [data.inputPorts, data.outputPorts, id, onPortClick]);

    const handleSetPrimary = useCallback((itemId: string) => updateBlock(id, { primaryOutputId: itemId }), [id, updateBlock]);

    return (
        <div
            style={{ width: data.size.width, minHeight: data.size.height }}
            className={`
                h-auto flex flex-col
                bg-slate-950 border rounded-lg shadow-2xl font-mono relative group transition-all duration-300
                ${selected ? 'border-cyan-500 ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]' : 'border-slate-800 hover:border-slate-700'}
                ${hasConflict && !selected ? 'border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}
            `}
        >
            {/* DEBUG COLLISION BOUNDARY (PINK/RED)
            <div
                className={`absolute top-0 left-0 border-2 pointer-events-none z-[500] ${isNodeColliding ? 'border-red-500 animate-pulse' : 'border-pink-500/40'}`}
                style={{ width: data.size.width, height: data.size.height }}
            >
                <div className={`absolute top-0 right-0 ${isNodeColliding ? 'bg-red-500' : 'bg-pink-500'} text-white text-[8px] px-1 font-black`}>
                    {isNodeColliding ? 'COLLISION' : `BOX: ${data.size.width}x${data.size.height}`}
                </div>
            </div>
            */}

            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full h-1 rounded-t-lg bg-gradient-to-r ${hasConflict ? 'from-red-600 to-red-400' : (selected ? 'from-cyan-400 to-blue-500' : 'from-slate-700 to-slate-800')}`}></div>

            {/* HEADER SECTION: Strict Height Enforcement */}
            <div style={{ height: BLOCK_LAYOUT.HEADER }} className="flex flex-col flex-none relative z-10">
                <BlockHeader
                    id={id}
                    recipeId={data.recipeId}
                    label={data.name}
                    subLabel={recipe?.category || 'Production'}
                    targetRate={data.calculationMode === 'output' ? data.targetRate : data.actualRate}
                    calculationMode={data.calculationMode}
                    hasConflict={hasConflict}
                    selected={selected}
                    onDelete={handleDelete}
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

            {/* BODY: The Flow (Input -> Machine -> Output) */}
            <div className="flex-1 p-[10px] pt-0 grid grid-cols-[100px_1fr_100px] gap-2 items-stretch relative box-border">
                <BlockPortList
                    ports={data.inputPorts}
                    side="input"
                    portStates={portStates}
                    getItemName={getItemName}
                    onPortClick={handlePortClick}
                />

                {/* CENTER: THE MACHINE MATH */}
                <div className="relative h-full w-full pointer-events-none">
                    {/* Spacer to keep consistency if needed, though now purely visual if at all */}
                    <div style={{ height: BLOCK_LAYOUT.PORT_LABEL }} className="w-full flex-none" />

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[12px] -z-10 opacity-40 text-slate-900/50">
                        <ArrowRight size={48} strokeWidth={3} />
                    </div>

                    {/* Required Count */}
                    <div className={`
                        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[12px] pointer-events-auto
                        bg-slate-900 border rounded px-3 py-1 text-center shadow-lg transition-all group-hover:border-cyan-500/20
                        ${data.calculationMode === 'machines' ? 'border-cyan-500/50' : 'border-slate-800'}
                    `}>
                        <div className={`text-[9px] uppercase font-black tracking-widest mb-0.5 transition-colors ${data.calculationMode === 'machines' ? 'text-cyan-500' : 'text-slate-500'}`}>
                            {data.calculationMode === 'machines' ? 'Fixed' : 'Required'}
                        </div>
                        <div className="flex items-baseline justify-center">
                            <input
                                ref={machineInputRef}
                                type="number"
                                step="0.1"
                                value={data.calculationMode === 'machines' ? (data.targetMachineCount ?? data.machineCount) : data.machineCount.toFixed(1)}
                                onChange={(e) => {
                                    handleUpdateMachineCount(parseFloat(e.target.value) || 0);
                                }}
                                className={`
                                    bg-transparent text-xl font-black focus:outline-none w-16 text-center
                                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                    nodrag nopan pointer-events-auto transition-all rounded
                                    hover:bg-white/5 focus:bg-white/10 cursor-text
                                    ${data.calculationMode === 'machines' ? 'text-white' : 'text-white/60'}
                                `}
                            />
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

            {/* FOOTER: Meta Data */}
            <div style={{ height: BLOCK_LAYOUT.FOOTER }} className="mt-auto bg-slate-950/80 border-t border-slate-900 rounded-b-lg px-2.5 flex justify-between items-center text-[9px] font-bold text-slate-500 tracking-wider box-border">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors">
                        <Zap size={11} /> {formatPower(totalPowerWatts)}
                    </span>
                    <span className={`flex items-center gap-1.5 transition-colors ${hasConflict ? 'text-red-500 animate-pulse' : 'hover:text-emerald-500'}`}>
                        <Activity size={11} /> {hasConflict ? 'FLOW CONFLICT' : '100% EFFICIENCY'}
                    </span>
                </div>
                <div className="px-2 opacity-30 font-mono italic">#{id.split('-')[0]}</div>
            </div>
        </div>
    );
};

export default memo(Block);
