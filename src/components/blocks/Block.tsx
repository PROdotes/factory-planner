import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Block as BlockType } from '@/types/block';
import { DSP_DATA } from '@/data/dsp';
import { useLayoutStore } from '@/stores/layoutStore';
import { Zap, Activity, Settings, ArrowRight, Trash2, Edit2, ChevronDown } from 'lucide-react';

const Block = ({ id, data, selected }: NodeProps<BlockType>) => {
    const deleteBlock = useLayoutStore((state) => state.deleteBlock);

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

    // Check for conflicts on connected edges
    const edges = useLayoutStore((state) => state.edges);
    const connectedEdges = edges.filter(e => e.source === id || e.target === id);
    const hasConflict = connectedEdges.some(e => (e.data?.status === 'bottleneck' || e.data?.status === 'overload' || e.data?.status === 'underload'));

    return (
        <div
            className={`
                w-[380px] bg-slate-950 border rounded-lg shadow-2xl font-mono overflow-hidden relative group transition-all duration-300
                ${selected ? 'border-cyan-500 ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]' : 'border-slate-800 hover:border-slate-700'}
                ${hasConflict && !selected ? 'border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}
            `}
        >
            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${hasConflict ? 'from-red-600 to-red-400' : (selected ? 'from-cyan-400 to-blue-500' : 'from-slate-700 to-slate-800')}`}></div>

            {/* HEADER: Item & Target */}
            <div className="p-4 flex justify-between items-center border-b border-slate-900 bg-slate-900/40">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-slate-900/50 border rounded flex items-center justify-center shadow-inner transition-colors ${hasConflict ? 'border-red-500/30 text-red-500' : 'border-cyan-500/30 text-cyan-400'}`}>
                        <Settings size={20} className={selected && !hasConflict ? 'animate-spin-slow' : ''} />
                    </div>
                    <div>
                        <h2 className="text-slate-50 font-bold text-base leading-none uppercase tracking-wider truncate max-w-[150px]">
                            {data.name}
                        </h2>
                        <span className={`text-[10px] font-semibold uppercase tracking-widest mt-1 block ${hasConflict ? 'text-red-400/60' : 'text-cyan-400/60'}`}>
                            {recipe?.category || 'Production'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right group/input relative">
                        <div className="flex items-baseline gap-1 justify-end relative">
                            <input
                                type="number"
                                value={data.targetRate}
                                onChange={(e) => {
                                    useLayoutStore.getState().updateBlock(id, {
                                        targetRate: parseFloat(e.target.value) || 0
                                    });
                                }}
                                onFocus={(e) => {
                                    // Add minor event listener fix for chrome/edge scroll behavior
                                    const target = e.target as HTMLInputElement;
                                    const handleWheel = (event: WheelEvent) => {
                                        if (document.activeElement === target) {
                                            event.preventDefault();
                                            event.stopPropagation(); // Trap the event completely

                                            const step = event.shiftKey ? 10 : 1;
                                            const direction = event.deltaY < 0 ? 1 : -1;

                                            // We get the current value from the target value string
                                            // because closures might capture an old 'data.targetRate'
                                            const currentVal = parseFloat(target.value) || 0;
                                            const newVal = Math.max(0, currentVal + (direction * step));

                                            useLayoutStore.getState().updateBlock(id, {
                                                targetRate: newVal
                                            });
                                        }
                                    };
                                    // Registering with { passive: false } is required to allow preventDefault() in Chrome
                                    target.addEventListener('wheel', handleWheel, { passive: false });
                                    (target as any)._wheelFixed = handleWheel;
                                }}
                                onBlur={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    if ((target as any)._wheelFixed) {
                                        target.removeEventListener('wheel', (target as any)._wheelFixed);
                                    }
                                }}
                                className={`
                                    bg-transparent text-xl font-black focus:outline-none w-20 text-right 
                                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none 
                                    nodrag nopan pointer-events-auto transition-all rounded px-1
                                    hover:bg-white/5 focus:bg-white/10 cursor-text
                                    ${hasConflict ? 'text-red-400' : 'text-white'}
                                `}
                            />
                            <span className="text-xs font-bold text-white/50">/m</span>
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center justify-end gap-1">
                            {selected && <Edit2 size={8} className="text-cyan-400" />}
                            Target Output
                        </div>
                    </div>

                    {/* Delete Action */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteBlock(id);
                        }}
                        className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all transition-colors"
                        title="Deconstruct"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* MACHINE SELECTOR ROW: Full Width */}
            <div className="px-4 py-2 bg-slate-900/20 border-b border-slate-900/50 flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Equipment</span>
                {(() => {
                    const currentMachine = DSP_DATA.machines.find(m => m.id === data.machineId);
                    const alternatives = DSP_DATA.machines.filter(m =>
                        currentMachine &&
                        m.category === currentMachine.category &&
                        m.id !== currentMachine.id
                    );

                    const onMachineCycle = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (alternatives.length === 0) return;

                        const allInCategory = DSP_DATA.machines.filter(m =>
                            currentMachine && m.category === currentMachine.category
                        );
                        const currentIndex = allInCategory.findIndex(m => m.id === data.machineId);
                        const nextIndex = (currentIndex + 1) % allInCategory.length;
                        const nextMachine = allInCategory[nextIndex];

                        useLayoutStore.getState().updateBlock(id, {
                            machineId: nextMachine.id
                        });
                    };

                    return (
                        <div
                            onClick={onMachineCycle}
                            className={`
                                text-[10px] font-bold py-1 px-3 rounded border border-transparent transition-all flex items-center gap-2
                                ${alternatives.length > 0 ? 'cursor-pointer hover:bg-slate-800 hover:border-cyan-500/30 text-cyan-400 bg-slate-900 shadow-sm' : 'text-slate-400'}
                            `}
                        >
                            <span>{currentMachine?.name || 'Unknown'}</span>
                            {alternatives.length > 0 && (
                                <ChevronDown size={12} className="text-cyan-500/50" />
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* BODY: The Flow (Input -> Machine -> Output) */}
            <div className="p-4 grid grid-cols-[100px_1fr_100px] gap-2 items-center relative">

                <div className="flex flex-col gap-2.5">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter border-b border-slate-900 pb-1">Inputs</span>
                    {data.inputPorts.map((port) => {
                        const edge = edges.find(e => e.target === id && e.targetHandle === port.id);
                        const status = edge?.data?.status;
                        const isOverloaded = status === 'bottleneck' || status === 'overload';
                        const isStarved = status === 'underload';
                        const hasConflict = isOverloaded || isStarved;

                        const conflictColor = isOverloaded ? 'rgba(239,68,68,1)' : (isStarved ? 'rgba(251,191,36,1)' : 'rgba(6,182,212,0.5)');
                        const conflictBg = isOverloaded ? 'rgba(239,68,68,0.1)' : (isStarved ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)');

                        return (
                            <div key={port.id} className="relative group/port">
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={port.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        useLayoutStore.getState().onPortClick(id, port.id, 'input');
                                    }}
                                    style={{
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        borderColor: conflictColor,
                                        boxShadow: hasConflict ? `0 0 8px ${conflictColor}66` : 'none'
                                    }}
                                    className={`
                                        !left-[-4px] !w-3 !h-3 !bg-slate-900 transition-all !cursor-pointer z-50 !border-2
                                        ${!hasConflict ? 'hover:!border-cyan-400' : ''}
                                    `}
                                />
                                <div
                                    style={{
                                        borderLeftColor: hasConflict ? conflictColor : 'rgba(51,65,85,1)', // slate-700
                                        backgroundColor: conflictBg
                                    }}
                                    className={`
                                        flex flex-col px-2 py-1.5 rounded border-l-2 transition-colors
                                        ${!hasConflict ? 'hover:border-cyan-500/50' : ''}
                                    `}
                                >
                                    <span className={`text-[9px] truncate leading-tight mb-0.5 ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-slate-400')}`}>
                                        {getItemName(port.itemId)}
                                    </span>
                                    <span className={`text-[11px] font-bold leading-tight ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-cyan-200/80')}`}>
                                        {port.rate.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* CENTER: THE MACHINE MATH */}
                <div className="flex flex-col items-center justify-center py-2 relative">
                    <div className="absolute text-slate-900/50 -z-10 opacity-40">
                        <ArrowRight size={48} strokeWidth={3} />
                    </div>

                    {/* Required Count (Bottom) */}
                    <div className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-center shadow-lg transition-colors group-hover:border-cyan-500/20">
                        <span className="text-[9px] uppercase font-black tracking-widest text-cyan-500">Required</span>
                        <div className="text-3xl font-black text-white leading-none my-1 tracking-tighter">
                            {data.machineCount.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold">
                            Units ({Math.ceil(data.machineCount)})
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2.5">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter border-b border-slate-900 pb-1 text-right">Outputs</span>
                    {data.outputPorts.map((port) => {
                        const edge = edges.find(e => e.source === id && e.sourceHandle === port.id);
                        const status = edge?.data?.status;
                        const isOverloaded = status === 'bottleneck' || status === 'overload';
                        const isStarved = status === 'underload';
                        const hasConflict = isOverloaded || isStarved;

                        const conflictColor = isOverloaded ? 'rgba(239,68,68,1)' : (isStarved ? 'rgba(251,191,36,1)' : 'rgba(6,182,212,0.5)');
                        const conflictBg = isOverloaded ? 'rgba(239,68,68,0.1)' : (isStarved ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)');

                        return (
                            <div key={port.id} className="relative group/port">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={port.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        useLayoutStore.getState().onPortClick(id, port.id, 'output');
                                    }}
                                    style={{
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        borderColor: conflictColor,
                                        boxShadow: hasConflict ? `0 0 8px ${conflictColor}66` : 'none'
                                    }}
                                    className={`
                                        !right-[-4px] !w-3 !h-3 !bg-slate-900 transition-all !cursor-pointer z-50 !border-2
                                        ${!hasConflict ? 'hover:!border-cyan-400' : ''}
                                    `}
                                />
                                <div
                                    style={{
                                        borderRightColor: hasConflict ? conflictColor : 'rgba(51,65,85,1)', // slate-700
                                        backgroundColor: conflictBg
                                    }}
                                    className={`
                                        flex flex-col px-2 py-1.5 rounded border-r-2 items-end transition-colors
                                        ${!hasConflict ? 'hover:border-cyan-500/50' : ''}
                                    `}
                                >
                                    <span className={`text-[9px] truncate leading-tight mb-0.5 ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-slate-400')}`}>
                                        {getItemName(port.itemId)}
                                    </span>
                                    <span className={`text-[11px] font-bold leading-tight ${isOverloaded ? 'text-red-400' : (isStarved ? 'text-amber-400' : 'text-cyan-200/80')}`}>
                                        {port.rate.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* FOOTER: Meta Data */}
            <div className="bg-slate-950/80 border-t border-slate-900 p-2.5 flex justify-between items-center text-[9px] font-bold text-slate-500 tracking-wider">
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
