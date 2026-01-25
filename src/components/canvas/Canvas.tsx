import React, { useRef, useCallback, useMemo } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    ReactFlowProvider,
    useReactFlow,
    NodeTypes,
    EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLayoutStore } from '@/stores/layoutStore';
import Block from '@/components/blocks/Block';
import ConnectionEdge from '@/components/connections/ConnectionEdge';

interface CanvasProps {
    className?: string;
}

const CanvasContent: React.FC<CanvasProps> = ({ className = '' }) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { project } = useReactFlow();

    const nodes = useLayoutStore((state) => state.nodes);
    const edges = useLayoutStore((state) => state.edges);
    const onNodesChange = useLayoutStore((state) => state.onNodesChange);
    const onEdgesChange = useLayoutStore((state) => state.onEdgesChange);
    const onConnect = useLayoutStore((state) => state.onConnect);
    const addBlock = useLayoutStore((state) => state.addBlock);

    const nodeTypes = useMemo<NodeTypes>(() => ({
        block: Block,
    }), []);

    const edgeTypes = useMemo<EdgeTypes>(() => ({
        connection: ConnectionEdge,
    }), []);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const recipeId = event.dataTransfer.getData('recipeId');

            if (typeof type === 'undefined' || !type || !recipeId) {
                return;
            }

            if (reactFlowWrapper.current) {
                const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
                const position = project({
                    x: event.clientX - reactFlowBounds.left,
                    y: event.clientY - reactFlowBounds.top,
                });

                addBlock(recipeId, position);
            }
        },
        [project, addBlock]
    );

    return (
        <div className={`w-full h-full ${className}`} ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onDragOver={onDragOver}
                onDrop={onDrop}
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

                <Controls
                    showInteractive={false}
                    className="custom-controls"
                />
            </ReactFlow>
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = (props) => (
    <ReactFlowProvider>
        <CanvasContent {...props} />
    </ReactFlowProvider>
);
