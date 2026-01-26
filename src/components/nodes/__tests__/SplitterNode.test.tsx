import { render, screen } from '@testing-library/react';
import SplitterNode from '../SplitterNode';
import { describe, it, expect, vi } from 'vitest';
import { NodeProps } from 'reactflow';
import { SplitterNodeData } from '@/types/block';

// Mock ReactFlow Handle
vi.mock('reactflow', async () => {
    return {
        Handle: (props: any) => (
            <div
                data-testid={`handle-${props.type}-${props.id}`}
                className={props.className}
            />
        ),
        Position: { Left: 'left', Right: 'right' }
    };
});

// Mock Icons
vi.mock('lucide-react', () => ({
    GitMerge: () => <div data-testid="icon-git-merge" />,
    Filter: () => <div data-testid="icon-filter" />,
    ArrowLeftRight: () => <div data-testid="icon-arrows" />,
    ArrowRight: () => <div />
}));

describe('SplitterNode Component', () => {
    const mockData: SplitterNodeData = {
        id: 'split-1',
        type: 'splitter',
        position: { x: 0, y: 0 },
        inputPorts: [{ id: 'in', type: 'input', itemId: 'any', rate: 60, side: 'left', offset: 0.5 }],
        outputPorts: [
            { id: 'out1', type: 'output', itemId: 'any', rate: 30, side: 'right', offset: 0.3 },
            { id: 'out2', type: 'output', itemId: 'any', rate: 30, side: 'right', offset: 0.7 }
        ],
        priority: 'balanced'
    };

    const defaultProps: NodeProps<SplitterNodeData> = {
        id: 'node-1',
        data: mockData,
        selected: false,
        zIndex: 1,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        type: 'splitter',
        sourcePosition: undefined,
        targetPosition: undefined
    };

    it('renders basic structure', () => {
        render(<SplitterNode {...defaultProps} />);
        expect(screen.getByText('splitter')).toBeInTheDocument();
        expect(screen.getByTestId('icon-git-merge')).toBeInTheDocument();
    });

    it('renders handles', () => {
        render(<SplitterNode {...defaultProps} />);
        expect(screen.getByTestId('handle-target-in')).toBeInTheDocument();
        expect(screen.getByTestId('handle-source-out1')).toBeInTheDocument();
        expect(screen.getByTestId('handle-source-out2')).toBeInTheDocument();
    });

    it('shows config overlay only when selected', () => {
        const { rerender } = render(<SplitterNode {...defaultProps} selected={false} />);
        expect(screen.queryByText('BALANCED')).not.toBeInTheDocument();

        rerender(<SplitterNode {...defaultProps} selected={true} />);
        expect(screen.getByText('BALANCED')).toBeInTheDocument();
    });

    it('shows filter info if set', () => {
        const dataWithFilter: SplitterNodeData = {
            ...mockData,
            filterItemId: 'iron-ore',
            priority: 'left' // usually filter implies priority
        };
        render(<SplitterNode {...defaultProps} data={dataWithFilter} selected={true} />);

        expect(screen.getByText('iron-ore')).toBeInTheDocument();
        expect(screen.getByText('LEFT')).toBeInTheDocument();
    });
});
