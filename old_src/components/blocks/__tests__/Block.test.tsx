import { render, screen, fireEvent } from '@testing-library/react';
import Block from '../Block';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLayoutStore } from '@/stores/layoutStore';
import { NodeProps } from 'reactflow';
import { Block as BlockType } from '@/types/block';

// Mock reactflow components
    vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        Handle: (props: unknown) => {
            const p = props as { type?: string; id?: string; onClick?: () => void; children?: any };
            return <div data-testid={`handle-${p.type}-${p.id}`} onClick={p.onClick}>{p.children}</div>;
        },
        Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' }
    };
});

// Mock Store
vi.mock('@/stores/layoutStore', () => ({
    useLayoutStore: vi.fn()
}));

const mockBlockData: BlockType = {
    id: 'test-block-1',
    type: 'block',
    name: 'Iron Ingot',
    recipeId: 'iron-ingot',
    machineId: 'arc-smelter',
    calculationMode: 'output',
    targetRate: 60,
    speedModifier: 1.0,
    primaryOutputId: 'iron-ingot',
    machineCount: 1,
    actualRate: 60,

    size: { width: 100, height: 100 },
    inputPorts: [
        { id: 'in-1', type: 'input', itemId: 'iron-ore', rate: 60, side: 'left', offset: 0.5 }
    ],
    outputPorts: [
        { id: 'out-1', type: 'output', itemId: 'iron-ingot', rate: 60, side: 'right', offset: 0.5 }
    ],
    efficiency: 1.0
};

const mockNodeProps: NodeProps<BlockType> = {
    id: 'test-block-1',
    data: mockBlockData,
    selected: false,
    zIndex: 1,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
    type: 'block',
    sourcePosition: undefined,
    targetPosition: undefined
};

describe('Block Component', () => {
    const mockDeleteBlock = vi.fn();
    const mockUpdateBlock = vi.fn();
    const mockOnPortClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock the store selector implementation
        (useLayoutStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: unknown) => {
            const state = {
                deleteBlock: mockDeleteBlock,
                updateBlock: mockUpdateBlock,
                onPortClick: mockOnPortClick,
                edges: [], // No connections by default
                nodes: [{ id: 'test-block-1', data: mockBlockData }],
                viewSettings: { flowMode: false }
            };
            return typeof selector === 'function' ? selector(state) : state;
        });

        // Also need to allow useLayoutStore.getState() calls
        (useLayoutStore as unknown as { getState?: () => unknown }).getState = () => ({
            deleteBlock: mockDeleteBlock,
            updateBlock: mockUpdateBlock,
            onPortClick: mockOnPortClick,
            edges: [],
            nodes: [{ id: 'test-block-1', data: mockBlockData }],
            viewSettings: { flowMode: false }
        });
    });

    it('renders block title and machine info', () => {
        render(<Block {...mockNodeProps} />);

        // Check for heading explicitly to handle truncation structure
        // The component uses an h2 tag
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Iron Ingot/i);
        expect(screen.getByText(/Arc Smelter/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('1.0')).toBeInTheDocument();
    });

    it('renders input and output ports', () => {
        render(<Block {...mockNodeProps} />);
        // Iron Ore only appears once (input)
        expect(screen.getByText(/Iron Ore/i)).toBeInTheDocument();

        // Iron Ingot appears in Title and Output Port -> Should have at least 2
        const ingots = screen.getAllByText(/Iron Ingot/i);
        expect(ingots.length).toBeGreaterThanOrEqual(2);

        expect(screen.getByTestId('handle-target-in-1')).toBeInTheDocument();
        expect(screen.getByTestId('handle-source-out-1')).toBeInTheDocument();
    });

    it('calls deleteBlock when delete button is clicked', () => {
        render(<Block {...mockNodeProps} />);
        const deleteBtn = screen.getByTitle('Deconstruct');
        fireEvent.click(deleteBtn);
        expect(mockDeleteBlock).toHaveBeenCalledWith('test-block-1');
    });

    it('updates target rate when input changes', () => {
        render(<Block {...mockNodeProps} />);
        const input = screen.getByDisplayValue('60');
        fireEvent.change(input, { target: { value: '120' } });
        expect(mockUpdateBlock).toHaveBeenCalledWith('test-block-1', expect.objectContaining({ targetRate: 120 }));
    });
});
