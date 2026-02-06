import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SplitterNodeData, BLOCK_LAYOUT, BLOCK_FLOW_LAYOUT } from '@/types/block';
import { GitMerge, Filter, ArrowLeftRight, Shuffle } from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';

const SplitterNode = ({ id, data, selected }: NodeProps<SplitterNodeData>) => {
    const updateBlock = useLayoutStore(state => state.updateBlock);
    const flowMode = useLayoutStore(state => state.viewSettings.flowMode);

    // Dynamic size based on mode
    const width = flowMode ? BLOCK_FLOW_LAYOUT.SPLITTER_SIZE : BLOCK_LAYOUT.SPLITTER_SIZE;
    const height = flowMode ? BLOCK_FLOW_LAYOUT.SPLITTER_SIZE : BLOCK_LAYOUT.SPLITTER_SIZE;

    const cycleType = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Cycle: Splitter -> Balancer -> Merger -> Splitter
        const nextType = data.type === 'splitter' ? 'balancer' : (data.type === 'balancer' ? 'merger' : 'splitter');

        let inputPorts: Array<any> = [];
        let outputPorts: Array<any> = [];

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
                    bg-slate-900 border rounded flex items-center justify-center relative shadow-lg transition-all
                    ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-700 hover:border-slate-600'}
                `}
                onClick={cycleType}
            >
                <div className="text-white/70">
                    {data.type === 'balancer' ? <Shuffle size={BLOCK_FLOW_LAYOUT.HANDLE_SIZE} /> : (data.type === 'splitter' ? <GitMerge className="rotate-90" size={BLOCK_FLOW_LAYOUT.HANDLE_SIZE} /> : <GitMerge className="-rotate-90" size={BLOCK_FLOW_LAYOUT.HANDLE_SIZE} />)}
                </div>

                {/* Handles */}
                {[...data.inputPorts, ...data.outputPorts].map((port) => {
                    const isInput = port.type === 'input';
                    const side = port.side;
                    let position = Position.Left;
                    const offsetInPx = -BLOCK_FLOW_LAYOUT.HANDLE_SIZE / 2; // Dynamic offset based on handle size
                    const handlePos = `${(port.offset ?? 0.5) * 100}%`;
                    let style: React.CSSProperties = { top: handlePos, left: offsetInPx };

                    if (side === 'right') {
                        position = Position.Right;
                        style = { top: handlePos, right: offsetInPx, transform: 'translateY(-50%)' };
                    } else if (side === 'top') {
                        position = Position.Top;
                        style = { left: handlePos, top: offsetInPx, transform: 'translateX(-50%)' };
                    } else if (side === 'bottom') {
                        position = Position.Bottom;
                        style = { left: handlePos, bottom: offsetInPx, transform: 'translateX(-50%)' };
                    } else {
                        // Left
                        style = { top: handlePos, left: offsetInPx, transform: 'translateY(-50%)' };
                    }

                    return (
                        <Handle
                            key={port.id}
                            type={isInput ? "target" : "source"}
                            position={position}
                            id={port.id}
                            className="!bg-slate-900 !border-slate-500 z-50"
                            style={{ ...style, width: BLOCK_FLOW_LAYOUT.HANDLE_SIZE, height: BLOCK_FLOW_LAYOUT.HANDLE_SIZE }}
                        />
                    );
                })}
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
                className={`rounded-full cursor-pointer hover:bg-slate-700 transition-colors bg-slate-800 ${selected ? 'text-amber-500' : 'text-slate-400'}`}
                style={{ padding: BLOCK_LAYOUT.CONTROLS_BUTTON_PADDING }}
            >
                {data.type === 'balancer' ? <Shuffle size={BLOCK_LAYOUT.CENTER_ARROW_SIZE} /> : (data.type === 'splitter' ? <GitMerge className="rotate-90" size={BLOCK_LAYOUT.CENTER_ARROW_SIZE} /> : <GitMerge className="-rotate-90" size={BLOCK_LAYOUT.CENTER_ARROW_SIZE} />)}
            </div>

            {/* Config Overlay */}
            {selected && (
                <div
                    onClick={cyclePriority}
                    className="absolute left-1/2 -translate-x-1/2 bg-slate-800 rounded font-mono border border-slate-700 whitespace-nowrap z-50 flex flex-col items-center cursor-pointer hover:border-amber-500 transition-colors"
                    style={{ top: -BLOCK_LAYOUT.SPLITTER_CONFIG_OFFSET_Y, paddingLeft: BLOCK_LAYOUT.SPLITTER_CONFIG_PADDING_X, paddingRight: BLOCK_LAYOUT.SPLITTER_CONFIG_PADDING_X, paddingTop: BLOCK_LAYOUT.SPLITTER_CONFIG_PADDING_Y, paddingBottom: BLOCK_LAYOUT.SPLITTER_CONFIG_PADDING_Y, fontSize: BLOCK_LAYOUT.SPLITTER_CONFIG_FONT_SIZE, gap: BLOCK_LAYOUT.SPLITTER_CONFIG_GAP }}
                >
                    <div className="font-bold text-amber-500 uppercase flex items-center" style={{ gap: BLOCK_LAYOUT.SPLITTER_CONFIG_GAP }}>
                        <ArrowLeftRight size={BLOCK_LAYOUT.SPLITTER_CONFIG_ICON_SIZE} /> {data.priority.replace('-', ' ').toUpperCase()}
                    </div>
                    {data.filterItemId && (
                        <div className="text-cyan-400 flex items-center" style={{ gap: BLOCK_LAYOUT.SPLITTER_CONFIG_GAP }}>
                            <Filter size={BLOCK_LAYOUT.SPLITTER_CONFIG_ICON_SIZE} /> {data.filterItemId}
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
                    className="!bg-slate-900 !border-2 !border-slate-500 hover:!border-amber-400 z-50"
                    style={{
                        position: 'absolute',
                        left: -BLOCK_LAYOUT.HANDLE_OFFSET,
                        top: height * (port.offset ?? 0.5),
                        transform: 'translateY(-50%)',
                        width: BLOCK_LAYOUT.HANDLE_SIZE,
                        height: BLOCK_LAYOUT.HANDLE_SIZE
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
                    className="!bg-slate-900 !border-2 !border-slate-500 hover:!border-amber-400 z-50"
                    style={{
                        position: 'absolute',
                        right: -BLOCK_LAYOUT.HANDLE_OFFSET,
                        top: height * (port.offset ?? 0.5),
                        transform: 'translateY(-50%)',
                        width: BLOCK_LAYOUT.HANDLE_SIZE,
                        height: BLOCK_LAYOUT.HANDLE_SIZE
                    }}
                />
            ))}

            <div className="absolute text-slate-500 uppercase tracking-widest font-bold" style={{ bottom: -BLOCK_LAYOUT.SPLITTER_LABEL_OFFSET_Y, fontSize: BLOCK_LAYOUT.SPLITTER_LABEL_FONT_SIZE }}>
                {data.type}
            </div>
        </div>
    );
};

export default memo(SplitterNode);
