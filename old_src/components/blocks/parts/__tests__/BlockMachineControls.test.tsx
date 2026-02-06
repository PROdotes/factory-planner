import { render, screen, fireEvent } from '@testing-library/react';
import { BlockMachineControls } from '../BlockMachineControls';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BlockMachineControls Component', () => {
    const defaultProps = {
        machineName: 'Arc Smelter',
        hasAlternatives: false,
        onCycleMachine: vi.fn(),
        modifier: undefined,
        onUpdateModifier: vi.fn(),
        height: 50
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders machine name', () => {
        render(<BlockMachineControls {...defaultProps} />);
        expect(screen.getByText('Arc Smelter')).toBeInTheDocument();
    });

    it('calls onCycleMachine when clicked if alternatives exist', () => {
        render(<BlockMachineControls {...defaultProps} hasAlternatives={true} />);
        fireEvent.click(screen.getByText('Arc Smelter'));
        expect(defaultProps.onCycleMachine).toHaveBeenCalled();
    });

    it('does NOT call onCycleMachine if no alternatives', () => {
        render(<BlockMachineControls {...defaultProps} hasAlternatives={false} />);
        fireEvent.click(screen.getByText('Arc Smelter'));
        expect(defaultProps.onCycleMachine).not.toHaveBeenCalled();
    });

    it('cycles modifier level', () => {
        render(<BlockMachineControls {...defaultProps} />);
        const btn = screen.getByTitle(/Proliferator Level/i);
        fireEvent.click(btn);

        // Should go from undefined (0) to level 1
        expect(defaultProps.onUpdateModifier).toHaveBeenCalledWith(expect.objectContaining({
            level: 1,
            type: 'speed'
        }));
    });

    it('toggles modifier type when active', () => {
        render(<BlockMachineControls {...defaultProps} modifier={{ level: 2, type: 'speed', includeConsumption: true }} />);

        // Type toggle button should be visible
        const typeBtn = screen.getByText('Speed');
        fireEvent.click(typeBtn);

        expect(defaultProps.onUpdateModifier).toHaveBeenCalledWith(expect.objectContaining({
            type: 'productivity'
        }));
    });

    it('hides type toggle when level is 0', () => {
        render(<BlockMachineControls {...defaultProps} modifier={undefined} />);
        expect(screen.queryByText('Speed')).not.toBeInTheDocument();
        expect(screen.queryByText('Prod')).not.toBeInTheDocument();
    });
});
