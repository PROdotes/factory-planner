import { render, screen, fireEvent } from '@testing-library/react';
import { BlockPortList, PortState } from '../BlockPortList';
import { describe, it, expect, vi } from 'vitest';
import { Port } from '@/types/block';

// Mock ReactFlow Handle
vi.mock('reactflow', async () => {
    return {
        Handle: (props: any) => (
            <div
                data-testid={`handle-${props.type}-${props.id}`}
                className={props.className}
                onClick={props.onClick}
                style={props.style}
            />
        ),
        Position: { Left: 'left', Right: 'right' }
    };
});

describe('BlockPortList Component', () => {
    const mockPorts: Port[] = [
        { id: 'p1', itemId: 'iron-ore', rate: 60, type: 'input', side: 'left', offset: 0.5 },
        { id: 'p2', itemId: 'copper-ore', rate: 30, type: 'input', side: 'left', offset: 0.8 }
    ];

    const mockStates: Record<string, PortState> = {
        'p1': { status: 'ok', connected: true },
        'p2': { status: 'underload', connected: true }
    };

    const defaultProps = {
        ports: mockPorts,
        side: 'input' as const,
        nodeId: 'node-1',
        portStates: mockStates,
        getItemName: (id: string) => id.toUpperCase().replace('-', ' '),
        onPortClick: vi.fn(),
    };

    it('renders list of ports', () => {
        render(<BlockPortList {...defaultProps} />);
        expect(screen.getByText('Inputs')).toBeInTheDocument();
        expect(screen.getByText('IRON ORE')).toBeInTheDocument();
        expect(screen.getByText('COPPER ORE')).toBeInTheDocument();
    });

    it('displays rates', () => {
        render(<BlockPortList {...defaultProps} />);
        expect(screen.getByText('60.0')).toBeInTheDocument();
        expect(screen.getByText('30.0')).toBeInTheDocument();
    });

    it('applies starvation styles', () => {
        render(<BlockPortList {...defaultProps} />);
        const copperRate = screen.getByText('30.0');
        expect(copperRate).toHaveClass('text-amber-400');
    });

    it('renders handles', () => {
        render(<BlockPortList {...defaultProps} />);
        expect(screen.getByTestId('handle-target-p1')).toBeInTheDocument();
        expect(screen.getByTestId('handle-target-p2')).toBeInTheDocument();
    });

    it('calls onPortClick when handle clicked', () => {
        render(<BlockPortList {...defaultProps} />);
        fireEvent.click(screen.getByTestId('handle-target-p1'));
        expect(defaultProps.onPortClick).toHaveBeenCalledWith('p1');
    });

    it('renders primary output button for outputs', () => {
        const outputProps = {
            ...defaultProps,
            side: 'output' as const,
            ports: [
                { id: 'out1', itemId: 'item1', rate: 10, type: 'output', side: 'right', offset: 0.5 },
                { id: 'out2', itemId: 'item2', rate: 10, type: 'output', side: 'right', offset: 0.5 }
            ],
            portStates: {},
            onSetPrimary: vi.fn()
        };
        render(<BlockPortList {...outputProps} />);

        const starButtons = screen.getAllByTitle('Set as Primary Output');
        expect(starButtons).toHaveLength(2);

        fireEvent.click(starButtons[0]);
        expect(outputProps.onSetPrimary).toHaveBeenCalledWith('item1');
    });
});
