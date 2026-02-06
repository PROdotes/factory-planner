import { memo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Activity, ArrowRight, ChevronDown, Trash2 } from 'lucide-react';
import { Block as BlockType } from '@/types/block';
import { formatRate, rateUnitSuffix } from '@/lib/rates';
import { useGameStore } from '@/stores/gameStore';
import { Recipe, Machine } from '@/types/game';
import { ModifierState } from '@/types/block';

interface BlockDetailModalProps {
    data: BlockType;
    recipe: Recipe | undefined;
    machine: Machine | undefined;
    totalPower: number;
    hasConflict: boolean;
    onClose: () => void;
    onUpdateRate: (rate: number) => void;
    onUpdateMachineCount: (count: number) => void;
    onCycleMachine: () => void;
    onUpdateModifier: (mod?: ModifierState) => void;
    onDelete: () => void;
    formatPower: (watts: number) => string;
    getItemName: (id: string) => string;
}

export const BlockDetailModal = memo(({
    data,
    recipe,
    machine,
    totalPower,
    hasConflict,
    onClose,
    onUpdateRate,
    onUpdateMachineCount,
    onCycleMachine,
    onUpdateModifier,
    onDelete,
    formatPower,
    getItemName
}: BlockDetailModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const { game } = useGameStore();
    const rateUnit = game.settings.rateUnit;

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Delay to prevent immediate close from the click that opened the modal
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const modifier = data.modifier;

    const content = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[400px] max-h-[80vh] flex flex-col font-mono"
            >
                {/* Header */}
                <div className="flex-none p-4 border-b border-slate-800 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-black text-white">{data.name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">
                            {recipe?.category || 'Production'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0">
                    {/* Inputs & Outputs */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                        {/* Inputs */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Inputs</div>
                            {data.inputPorts.length === 0 ? (
                                <div className="text-xs text-slate-600 italic">None (Source)</div>
                            ) : (
                                data.inputPorts.map(port => (
                                    <div key={port.id} className="flex items-center justify-between bg-slate-800/50 rounded px-2 py-1">
                                        <span className="text-xs text-slate-300 truncate">{getItemName(port.itemId)}</span>
                                        <span className="text-xs font-bold text-amber-400">
                                            {formatRate(port.rate, rateUnit)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="text-slate-600">
                            <ArrowRight size={24} />
                        </div>

                        {/* Outputs */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Outputs</div>
                            {data.outputPorts.map(port => (
                                <div key={port.id} className="flex items-center justify-between bg-slate-800/50 rounded px-2 py-1">
                                    <span className="text-xs text-slate-300 truncate">{getItemName(port.itemId)}</span>
                                    <span className="text-xs font-bold text-emerald-400">
                                        {formatRate(port.rate, rateUnit)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Machine Count & Rate */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                                {data.calculationMode === 'machines' ? 'Fixed Machines' : 'Needed Machines'}
                            </div>
                            <input
                                type="number"
                                step="1"
                                value={data.calculationMode === 'machines' ? (data.targetMachineCount ?? data.machineCount) : data.machineCount.toFixed(1)}
                                onChange={(e) => onUpdateMachineCount(parseFloat(e.target.value) || 0)}
                                onWheel={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const direction = e.deltaY < 0 ? 1 : -1;
                                    const step = e.shiftKey ? 10 : 1;
                                    const currentVal = data.calculationMode === 'machines' ? (data.targetMachineCount ?? data.machineCount) : data.machineCount;
                                    onUpdateMachineCount(Math.max(0, Math.round(currentVal + (direction * step))));
                                }}
                                className="w-full bg-transparent text-2xl font-black text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Target Rate</div>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    step="1"
                                    value={data.targetRate.toFixed(1)}
                                    onChange={(e) => onUpdateRate(parseFloat(e.target.value) || 0)}
                                    onWheel={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const direction = e.deltaY < 0 ? 1 : -1;
                                        const step = e.shiftKey ? 10 : 1;
                                        onUpdateRate(Math.max(0, data.targetRate + (direction * step)));
                                    }}
                                    className="w-full bg-transparent text-2xl font-black text-cyan-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-slate-500 text-sm">
                                    {rateUnitSuffix(rateUnit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Machine Type */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Machine Type</div>
                        <button
                            onClick={onCycleMachine}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-700 rounded hover:border-cyan-500/50 transition-colors"
                        >
                            <span className="text-sm text-white">{machine?.name || 'Unknown'}</span>
                            <ChevronDown size={14} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Proliferator */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Proliferator</div>
                        <div className="flex items-center gap-2">
                            {/* Level buttons */}
                            {[0, 1, 2, 3].map(level => (
                                <button
                                    key={level}
                                    onClick={() => {
                                        if (level === 0) {
                                            onUpdateModifier(undefined);
                                        } else {
                                            onUpdateModifier({
                                                type: modifier?.type || 'speed',
                                                level,
                                                includeConsumption: true
                                            });
                                        }
                                    }}
                                    className={`
                                        flex-1 py-1.5 rounded text-xs font-bold transition-all border
                                        ${(modifier?.level || 0) === level
                                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}
                                    `}
                                >
                                    {level === 0 ? 'None' : `Mk.${level}`}
                                </button>
                            ))}
                        </div>
                        {/* Type toggle */}
                        {(modifier?.level || 0) > 0 && (
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => onUpdateModifier({ ...modifier!, type: 'speed' })}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all border ${modifier?.type === 'speed'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Speed
                                </button>
                                <button
                                    onClick={() => onUpdateModifier({ ...modifier!, type: 'productivity' })}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all border ${modifier?.type === 'productivity'
                                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Productivity
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-yellow-500">
                            <Zap size={14} />
                            <span className="font-bold">{formatPower(totalPower)}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasConflict ? 'text-red-500' : 'text-emerald-500'}`}>
                            <Activity size={14} />
                            <span className="font-bold">{hasConflict ? 'FLOW CONFLICT' : '100% Efficient'}</span>
                        </div>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="flex-none p-4 border-t border-slate-800 flex justify-between">
                    <button
                        onClick={() => {
                            onDelete();
                            onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-bold bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );

    // Render to body to escape ReactFlow's transform
    return createPortal(content, document.body);
});
