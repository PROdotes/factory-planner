import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SplitterNodeData, BLOCK_LAYOUT } from '@/types/block';
import { GitMerge, Filter, ArrowLeftRight, Shuffle } from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';

const SplitterNode = ({ id, data, selected }: NodeProps<SplitterNodeData>) => {
    const updateBlock = useLayoutStore(state => state.updateBlock);
    const flowMode = useLayoutStore(state => state.viewSettings.flowMode);

    // Dynamic size based on mode
    const width = flowMode ? 40 : 80;
    const height = flowMode ? 40 : 80;

    const cycleType = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Cycle: Splitter -> Balancer -> Merger -> Splitter
        const nextType = data.type === 'splitter' ? 'balancer' : (data.type === 'balancer' ? 'merger' : 'splitter');

        let inputPorts: any[] = [];
        let outputPorts: any[] = [];

        if (nextType === 'splitter') {
            inputPorts = [{ id: 'in-main', type: 'input', side: 'left', offset: 0.5, itemId: 'any', rate: 0 }];
            outputPorts = [
                { id: 'out-1', type: 'output', side: 'right', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'out-2', type: 'output', side: 'right', offset: 0.50, itemId: 'any', rate: 0 },
                { id: 'out-3', type: 'output', side: 'right', offset: 0.75, itemId: 'any', rate: 0 }
            ];
        } else if (nextType === 'balancer') {
            inputPorts = [
                { id: 'in-1', type: 'input', side: 'left', offset: 0.33, itemId: 'any', rate: 0 },
                { id: 'in-2', type: 'input', side: 'left', offset: 0.66, itemId: 'any', rate: 0 }
            ];
            outputPorts = [
                { id: 'out-1', type: 'output', side: 'right', offset: 0.33, itemId: 'any', rate: 0 },
                { id: 'out-2', type: 'output', side: 'right', offset: 0.66, itemId: 'any', rate: 0 }
            ];
        } else {
            // Merger
            inputPorts = [
                { id: 'in-1', type: 'input', side: 'left', offset: 0.25, itemId: 'any', rate: 0 },
                { id: 'in-2', type: 'input', side: 'left', offset: 0.50, itemId: 'any', rate: 0 },
                { id: 'in-3', type: 'input', side: 'left', offset: 0.75, itemId: 'any', rate: 0 }
            ];
            outputPorts = [{ id: 'out-main', type: 'output', side: 'right', offset: 0.5, itemId: 'any', rate: 0 }];
        }

        updateBlock(id, { type: nextType, inputPorts, outputPorts });
    };

    const cyclePriority = (e: React.MouseEvent) => {
        e.stopPropagation();
        const priorities: SplitterNodeData['priority'][] = ['balanced', 'out-left', 'out-right', 'in-left', 'in-right'];
        const nextIdx = (priorities.indexOf(data.priority) + 1) % priorities.length;
        updateBlock(id, { priority: priorities[nextIdx] });
    };

    if (flowMode) {
        return (
            <div
                style={{ width, height }}
                className={`
                    bg-slate-900 border rounded flex items-center justify-center relative shadow-lg transition-all rotate-45
                    ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700 hover:border-slate-600'}
                `}
                onClick={cycleType}
            >
                <div className="-rotate-45 text-white/70">
                    {data.type === 'balancer' ? <Shuffle size={16} /> : (data.type === 'splitter' ? <GitMerge className="rotate-90" size={16} /> : <GitMerge className="-rotate-90" size={16} />)}
                </div>

                {/* Handles - must adjust for rotation and smaller size */}
                {data.inputPorts.map((port) => (
                    <Handle
                        key={port.id}
                        type="target"
                        position={Position.Left}
                        id={port.id}
                        className="!bg-slate-900 !border-slate-500 !w-2 !h-2 z-50 !opacity-0"
                        style={{ top: '50%', left: 0 }}
                    />
                ))}
                {data.outputPorts.map((port) => (
                    <Handle
                        key={port.id}
                        type="source"
                        position={Position.Right}
                        id={port.id}
                        className="!bg-slate-900 !border-slate-500 !w-2 !h-2 z-50 !opacity-0"
                        style={{ top: '50%', right: 0 }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            style={{ width, height }}
            className={`
                bg-slate-900 border rounded-full flex flex-col items-center justify-center relative shadow-lg transition-all
                ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700 hover:border-slate-600'}
            `}
        >
            {/* Center Icon */}
            <div
                onClick={cycleType}
                className={`p-2 rounded-full cursor-pointer hover:bg-slate-700 transition-colors bg-slate-800 ${selected ? 'text-amber-500' : 'text-slate-400'}`}
            >
                {data.type === 'balancer' ? <Shuffle size={24} /> : (data.type === 'splitter' ? <GitMerge className="rotate-90" size={24} /> : <GitMerge className="-rotate-90" size={24} />)}
            </div>

            {/* Config Overlay */}
            {selected && (
                <div
                    onClick={cyclePriority}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 rounded px-2 py-1 text-[10px] font-mono border border-slate-700 whitespace-nowrap z-50 flex flex-col gap-1 items-center cursor-pointer hover:border-amber-500 transition-colors"
                >
                    <div className="font-bold text-amber-500 uppercase flex items-center gap-1">
                        <ArrowLeftRight size={10} /> {data.priority.replace('-', ' ').toUpperCase()}
                    </div>
                    {data.filterItemId && (
                        <div className="text-cyan-400 flex items-center gap-1">
                            <Filter size={10} /> {data.filterItemId}
                        </div>
                    )}
                </div>
            )}

            {/* Input Handles */}
            {data.inputPorts.map((port) => (
                <Handle
                    key={port.id}
                    type="target"
                    position={Position.Left}
                    id={port.id}
                    className="!bg-slate-900 !border-2 !border-slate-500 hover:!border-amber-400 !w-3 !h-3 z-50"
                    style={{
                        position: 'absolute',
                        left: -BLOCK_LAYOUT.HANDLE_OFFSET,
                        top: height * port.offset,
                        transform: 'translateY(-50%)'
                    }}
                />
            ))}

            {/* Output Handles */}
            {data.outputPorts.map((port) => (
                <Handle
                    key={port.id}
                    type="source"
                    position={Position.Right}
                    id={port.id}
                    className="!bg-slate-900 !border-2 !border-slate-500 hover:!border-amber-400 !w-3 !h-3 z-50"
                    style={{
                        position: 'absolute',
                        right: -BLOCK_LAYOUT.HANDLE_OFFSET,
                        top: height * port.offset,
                        transform: 'translateY(-50%)'
                    }}
                />
            ))}

            <div className="absolute -bottom-6 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {data.type}
            </div>
        </div>
    );
};

export default memo(SplitterNode);
