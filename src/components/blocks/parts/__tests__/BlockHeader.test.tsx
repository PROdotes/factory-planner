import { render, screen, fireEvent } from '@testing-library/react';
import { BlockHeader } from '../BlockHeader';
import { describe, it, expect, vi } from 'vitest';

describe('BlockHeader Component', () => {
    const defaultProps = {
        id: 'test-1',
        label: 'Iron Ingot',
        subLabel: 'Smelting',
        targetRate: 60,
        calculationMode: 'output' as const,
        hasConflict: false,
        selected: false,
        onDelete: vi.fn(),
        onUpdateRate: vi.fn(),
        height: 100
    };

    it('renders label and sublabel', () => {
        render(<BlockHeader {...defaultProps} />);
        expect(screen.getByRole('heading')).toHaveTextContent('Iron Ingot');
        expect(screen.getByText('Smelting')).toBeInTheDocument();
    });

    it('shows red text when conflict exists', () => {
        render(<BlockHeader {...defaultProps} hasConflict={true} />);
        const subLabel = screen.getByText('Smelting');
        expect(subLabel).toHaveClass('text-red-400/60');
    });

    it('calls onDelete when delete button clicked', () => {
        render(<BlockHeader {...defaultProps} />);
        const deleteBtn = screen.getByTitle('Deconstruct');
        fireEvent.click(deleteBtn);
        expect(defaultProps.onDelete).toHaveBeenCalled();
    });

    it('calls onUpdateRate when input changes', () => {
        render(<BlockHeader {...defaultProps} />);
        const input = screen.getByDisplayValue('60');
        fireEvent.change(input, { target: { value: '120' } });
        expect(defaultProps.onUpdateRate).toHaveBeenCalledWith(120);
    });

    it('handles mouse wheel on input', () => {
        render(<BlockHeader {...defaultProps} />);
        const input = screen.getByDisplayValue('60');

        // JSDOM focus handling
        input.focus();

        // Emulate shift+wheel UP (positive deltaY is usually DOWN, negative is UP)
        // deltaY < 0 means UP
        // shiftKey = true means +10
        const wheelEvent = new WheelEvent('wheel', {
            deltaY: -100,
            shiftKey: true,
            bubbles: true,
            cancelable: true
        });

        input.dispatchEvent(wheelEvent);

        // 60 + 10 = 70
        expect(defaultProps.onUpdateRate).toHaveBeenCalledWith(70);
    });
});
