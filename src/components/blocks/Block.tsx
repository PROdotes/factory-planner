import { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { Block as BlockType } from '@/types/block';
import { DSP_DATA } from '@/data/dsp';
import { useLayoutStore } from '@/stores/layoutStore';
import { ArrowRight, Activity, Zap } from 'lucide-react';

import { calculateBlockDimensions } from '@/lib/layout/manifoldSolver';
import { BlockHeader } from './parts/BlockHeader';
import { BlockMachineControls } from './parts/BlockMachineControls';
import { BlockPortList, PortState } from './parts/BlockPortList';

const Block = ({ id, data, selected }: NodeProps<BlockType>) => {
    const deleteBlock = useLayoutStore((state) => state.deleteBlock);
    const updateBlock = useLayoutStore((state) => state.updateBlock);
    const edges = useLayoutStore((state) => state.edges);
    const onPortClick = useLayoutStore((state) => state.onPortClick);

    // Calculate dimensions LIVE to ensure instant feedback on code changes
    const { size } = calculateBlockDimensions(data.inputPorts.length, data.outputPorts.length, data.machineCount);

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
    const handleUpdateRate = (newRate: number) => updateBlock(id, { targetRate: newRate });
    const handleDelete = () => deleteBlock(id);

    // Machine Logic
    const alternatives = useMemo(() => {
        return DSP_DATA.machines.filter(m =>
            currentMachine &&
            m.category === currentMachine.category &&
            m.id !== currentMachine.id
        );
    }, [currentMachine]);

    const handleCycleMachine = () => {
        if (alternatives.length === 0) return;
        const allInCategory = DSP_DATA.machines.filter(m =>
            currentMachine && m.category === currentMachine.category
        );
        const currentIndex = allInCategory.findIndex(m => m.id === data.machineId);
        const nextIndex = (currentIndex + 1) % allInCategory.length;
        const nextMachine = allInCategory[nextIndex];

        updateBlock(id, { machineId: nextMachine.id });
    };

    const handleUpdateModifier = (mod?: any) => updateBlock(id, { modifier: mod });

    const handlePortClick = (pid: string) => {
        // We need to know type. Input or Output?
        // Check inputs first
        if (data.inputPorts.some(p => p.id === pid)) {
            onPortClick(id, pid, 'input');
            return;
        }
        if (data.outputPorts.some(p => p.id === pid)) {
            onPortClick(id, pid, 'output');
            return;
        }
    };

    const handleSetPrimary = (itemId: string) => updateBlock(id, { primaryOutputId: itemId });

    return (
        <div
            style={{ width: size.width, minHeight: size.height }}
            className={`
                h-auto
                bg-slate-950 border rounded-lg shadow-2xl font-mono overflow-hidden relative group transition-all duration-300
                ${selected ? 'border-cyan-500 ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]' : 'border-slate-800 hover:border-slate-700'}
                ${hasConflict && !selected ? 'border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}
            `}
        >
            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${hasConflict ? 'from-red-600 to-red-400' : (selected ? 'from-cyan-400 to-blue-500' : 'from-slate-700 to-slate-800')}`}></div>

            <BlockHeader
                id={id}
                label={data.name}
                subLabel={recipe?.category || 'Production'}
                targetRate={data.targetRate}
                hasConflict={hasConflict}
                selected={selected}
                onDelete={handleDelete}
                onUpdateRate={handleUpdateRate}
            />

            <BlockMachineControls
                machineName={currentMachine?.name || 'Unknown'}
                hasAlternatives={alternatives.length > 0}
                onCycleMachine={handleCycleMachine}
                modifier={data.modifier}
                onUpdateModifier={handleUpdateModifier}
            />

            {/* BODY: The Flow (Input -> Machine -> Output) */}
            <div className="p-4 grid grid-cols-[100px_1fr_100px] gap-2 items-center relative">

                <BlockPortList
                    ports={data.inputPorts}
                    side="input"
                    nodeId={id}
                    portStates={portStates}
                    getItemName={getItemName}
                    onPortClick={handlePortClick}
                />

                {/* CENTER: THE MACHINE MATH */}
                <div className="flex flex-col items-center justify-center py-2 relative">
                    <div className="absolute text-slate-900/50 -z-10 opacity-40">
                        <ArrowRight size={48} strokeWidth={3} />
                    </div>

                    {/* Required Count */}
                    <div className="bg-slate-900 border border-slate-800 rounded px-3 py-1 text-center shadow-lg transition-colors group-hover:border-cyan-500/20">
                        <div className="text-[9px] uppercase font-black tracking-widest text-cyan-500/80 mb-0.5">Required</div>
                        <div className="text-xl font-black text-white leading-none tracking-tighter">
                            {data.machineCount.toFixed(1)}
                        </div>
                    </div>
                </div>

                <BlockPortList
                    ports={data.outputPorts}
                    side="output"
                    nodeId={id}
                    portStates={portStates}
                    getItemName={getItemName}
                    onPortClick={handlePortClick}
                    primaryOutputId={data.primaryOutputId}
                    onSetPrimary={handleSetPrimary}
                />
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
