import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../Toolbar';
import { describe, it, expect, vi } from 'vitest';
import { ReactFlowProvider } from 'reactflow';

// Mock the AppShell or just test Toolbar in isolation
describe('Toolbar', () => {
    it('renders the toolbar', () => {
        render(
            <ReactFlowProvider>
                <Toolbar />
            </ReactFlowProvider>
        );
        expect(screen.getByText('DSP')).toBeInTheDocument();
        expect(screen.getByText('FLOW')).toBeInTheDocument();
        expect(screen.getByText('New Block')).toBeInTheDocument();
    });

    it('renders navigation buttons with titles', () => {
        render(
            <ReactFlowProvider>
                <Toolbar />
            </ReactFlowProvider>
        );
        expect(screen.getByTitle('Save to Browser Storage')).toBeInTheDocument();
        expect(screen.getByTitle('Load from Browser Storage')).toBeInTheDocument();
        expect(screen.getByTitle('Export Layout JSON')).toBeInTheDocument();
        expect(screen.getByTitle('Import Layout JSON')).toBeInTheDocument();
        expect(screen.getByTitle('Clear All')).toBeInTheDocument();
    });

    it('invokes the data editor action', () => {
        const onOpenEditor = vi.fn();
        render(
            <ReactFlowProvider>
                <Toolbar onOpenEditor={onOpenEditor} />
            </ReactFlowProvider>
        );
        fireEvent.click(screen.getByText('Game Data'));
        expect(onOpenEditor).toHaveBeenCalledTimes(1);
    });
});
