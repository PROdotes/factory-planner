import React, { useRef, useCallback } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    useReactFlow,
    NodeTypes,
    EdgeTypes,
    NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLayoutStore } from '@/stores/layoutStore';
import Block from '@/components/blocks/Block';
import ConnectionEdge from '@/components/connections/ConnectionEdge';
import SplitterNode from '@/components/nodes/SplitterNode';
import ConnectionLine from '@/components/canvas/ConnectionLine';
import DebugBoundsOverlay from '@/components/canvas/DebugBoundsOverlay';

interface CanvasProps {
    className?: string;
}

// Keep node/edge type maps stable and out of the component to avoid
// recreating objects on every render (React Flow warns if these change).
const NODE_TYPES: NodeTypes = {
    block: Block,
    splitter: SplitterNode,
};

const EDGE_TYPES: EdgeTypes = {
    connection: ConnectionEdge,
};

const CanvasContent: React.FC<CanvasProps> = ({ className = '' }) => {
    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    const { project } = useReactFlow();

    // Provide memoized references for React Flow — this prevents the library
    // from warning when objects are recreated by HMR/runtime tooling.
    const nodeTypes = React.useMemo(() => NODE_TYPES, []);
    const edgeTypes = React.useMemo(() => EDGE_TYPES, []);

    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const onNodesChange = useLayoutStore((state) => state.onNodesChange);
    const onEdgesChange = useLayoutStore((state) => state.onEdgesChange);
    const onConnect = useLayoutStore((state) => state.onConnect);
    const addBlock = useLayoutStore((state) => state.addBlock);
    const snapToGrid = useLayoutStore((state) => state.viewSettings.snapToGrid);

    // Node/edge type maps are defined at module scope to keep
    // stable references across renders (prevents React Flow warnings).

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const draggingItem = useLayoutStore.getState().draggingItem;
            if (!draggingItem) return;

            if (reactFlowWrapper.current) {
                const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
                const position = project({
                    x: event.clientX - reactFlowBounds.left,
                    y: event.clientY - reactFlowBounds.top,
                });

                if (draggingItem.type === 'splitter') {
                    useLayoutStore.getState().addSplitter('splitter', position);
                } else if (draggingItem.type === 'new-block' && draggingItem.recipeId) {
                    addBlock(draggingItem.recipeId, position);
                }

                useLayoutStore.getState().setDraggingItem(null);
            }
        },
        [project, addBlock]
    );

    const connectingRef = useRef<{ nodeId: string; handleId: string; handleType: string } | null>(null);

    const onConnectStart = useCallback((_: unknown, payload: { nodeId: string | null; handleId?: string | null; handleType?: string | null }) => {
        const { nodeId, handleId, handleType } = payload;
        if (!nodeId || !handleId || !handleType) return;
        connectingRef.current = { nodeId, handleId: handleId.replace('-drag', ''), handleType };
    }, []);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
        if (!connectingRef.current) return;

        const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');

        if (targetIsPane && reactFlowWrapper.current) {
            const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
            const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches[0].clientX;
            const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches[0].clientY;

            const position = project({
                x: clientX - left,
                y: clientY - top,
            });

            useLayoutStore.getState().setActivePort({
                nodeId: connectingRef.current.nodeId,
                portId: connectingRef.current.handleId,
                type: connectingRef.current.handleType === 'source' ? 'output' : 'input'
            }, position);
        }

        connectingRef.current = null;
    }, [project]);

    // Wrap some React Flow callbacks to trigger an immediate overlay recompute
    // so the debug bounds stay in sync during interactions (drag / pan / zoom).
    const handleNodesChange = useCallback((changes: NodeChange[]) => {
        onNodesChange(changes as any);
        try {
            window.dispatchEvent(new Event('debugBounds:recompute'));
        } catch (e) {}
    }, [onNodesChange]);

    const handleNodeDrag = useCallback(() => {
        try { window.dispatchEvent(new Event('debugBounds:recompute')); } catch (e) {}
    }, []);

    const handleNodeDragStop = useCallback(() => {
        try { window.dispatchEvent(new Event('debugBounds:recompute')); } catch (e) {}
    }, []);

    const handleMove = useCallback(() => {
        try { window.dispatchEvent(new Event('debugBounds:recompute')); } catch (e) {}
    }, []);

    return (
        <div
            className={`w-full h-full ${className}`}
            ref={reactFlowWrapper}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={(connection) => {
                    onConnect(connection);
                    connectingRef.current = null;
                }}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                onMove={handleMove}
                onContextMenu={(e) => {
                    if (useLayoutStore.getState().draggingItem) {
                        e.preventDefault();
                        useLayoutStore.getState().setDraggingItem(null);
                    }
                }}
                onMouseUp={(e) => {
                    const draggingItem = useLayoutStore.getState().draggingItem;
                    if (draggingItem && reactFlowWrapper.current) {
                        const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
                        const position = project({
                            x: e.clientX - left,
                            y: e.clientY - top,
                        });

                        if (draggingItem.type === 'splitter') {
                            useLayoutStore.getState().addSplitter('splitter', position);
                        } else if (draggingItem.type === 'new-block' && draggingItem.recipeId) {
                            addBlock(draggingItem.recipeId, position);
                        }
                        useLayoutStore.getState().setDraggingItem(null);
                    }
                }}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineComponent={ConnectionLine}
                snapToGrid={snapToGrid}
                snapGrid={[20, 20]}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                defaultEdgeOptions={{
                    type: 'connection',
                    style: { stroke: '#3b82f6', strokeWidth: 2 },
                    animated: false,
                }}
                proOptions={{ hideAttribution: true }}
                className="bg-transparent"
                minZoom={0.05}
                maxZoom={2}
            >
                <Background
                    variant={BackgroundVariant.Lines}
                    color="rgba(59, 130, 246, 0.05)"
                    gap={40}
                    size={1}
                />
                <Background
                    variant={BackgroundVariant.Dots}
                    color="rgba(255, 255, 255, 0.05)"
                    gap={20}
                    size={1}
                    id="dots"
                />
                <Controls showInteractive={false} className="custom-controls" />
            </ReactFlow>
                {/* Place overlay as a sibling to ReactFlow internals so it sits above the canvas
                    and we can reliably portal into the viewport from the wrapper. */}
                <DebugBoundsOverlay containerRef={reactFlowWrapper} />
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = (props) => (
    <CanvasContent {...props} />
);
