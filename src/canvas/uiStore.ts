/**
 * ROLE: UI State Store
 * PURPOSE: Manages global UI visibility (sidebars, overlays) separately from the factory logic.
 */

import { create } from 'zustand';

interface UIState {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;

    focusedNodeId: string | null;

    rateUnit: 'per_second' | 'per_minute';
    autoSolveEnabled: boolean;

    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    setLeftSidebar: (open: boolean) => void;
    setRightSidebar: (open: boolean) => void;
    toggleFocus: (nodeId: string | null) => void;
    toggleRateUnit: () => void;
    toggleAutoSolve: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    // 1. [Visibility Toggles]
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    rateUnit: 'per_minute',
    autoSolveEnabled: false, // Default to Advisory Mode
    toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    setLeftSidebar: (open) => set({ leftSidebarOpen: open }),
    setRightSidebar: (open) => set({ rightSidebarOpen: open }),
    toggleRateUnit: () => set((state) => ({
        rateUnit: state.rateUnit === 'per_second' ? 'per_minute' : 'per_second'
    })),
    toggleAutoSolve: () => set((state) => ({ autoSolveEnabled: !state.autoSolveEnabled })),

    // 2. [Deep Focus Mode] - Managed separately from selection
    focusedNodeId: null,
    toggleFocus: (nodeId) => set((state) => ({
        focusedNodeId: (state.focusedNodeId === nodeId || !nodeId) ? null : nodeId
    })),
}));
