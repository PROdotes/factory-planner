import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SplitterNodeData, BLOCK_LAYOUT } from '@/types/block';
import { GitMerge, Filter, ArrowLeftRight } from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';

const SplitterNode = ({ id, data, selected }: NodeProps<SplitterNodeData>) => {
    const updateBlock = useLayoutStore(state => state.updateBlock);
    const isNodeColliding = useLayoutStore(state => state.nodeConflicts.has(id));

    // Fixed size for splitters for now
    const width = 80;
    const height = 80;

    const cycleType = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateBlock(id, { type: data.type === 'splitter' ? 'merger' : 'splitter' });
    };

    const cyclePriority = (e: React.MouseEvent) => {
        e.stopPropagation();
        const priorities: SplitterNodeData['priority'][] = ['balanced', 'out-left', 'out-right', 'in-left', 'in-right'];
        const nextIdx = (priorities.indexOf(data.priority) + 1) % priorities.length;
        updateBlock(id, { priority: priorities[nextIdx] });
    };

    return (
        <div
            style={{ width, height }}
            className={`
                bg-slate-900 border rounded-full flex flex-col items-center justify-center relative shadow-lg transition-all
                ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700 hover:border-slate-600'}
            `}
        >
            {/* DEBUG COLLISION BOUNDARY (PINK/RED) 
            <div
                className={`absolute inset-0 border-2 pointer-events-none z-[500] rounded-full ${isNodeColliding ? 'border-red-500 animate-pulse' : 'border-pink-500/40'}`}
                style={{ width, height }}
            >
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${isNodeColliding ? 'bg-red-500' : 'bg-pink-500'} text-white text-[8px] px-1 font-black whitespace-nowrap`}>
                    {isNodeColliding ? 'COLLISION' : `BOX: ${width}x${height}`}
                </div>
            </div>
            */}
            {/* Center Icon */}
            <div
                onClick={cycleType}
                className={`p-2 rounded-full cursor-pointer hover:bg-slate-700 transition-colors bg-slate-800 ${selected ? 'text-amber-500' : 'text-slate-400'}`}
            >
                {data.type === 'splitter' ? <GitMerge className="rotate-90" size={24} /> : <GitMerge className="-rotate-90" size={24} />}
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
