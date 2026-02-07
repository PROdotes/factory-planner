/**
 * ROLE: UI State Store
 * PURPOSE: Manages global UI visibility (sidebars, overlays) separately from the factory logic.
 */

import { create } from "zustand";

interface UIState {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  focusedNodeId: string | null;

  rateUnit: "per_second" | "per_minute";
  implicitSearch: {
    blockId: string;
    itemId: string;
    side: "left" | "right" | "Junction";
    worldPos: { x: number; y: number };
    clientPos: { x: number; y: number };
  } | null;
  iconMapperOpen: boolean;
  windEfficiency: number; // 0.0 to 2.0 (0% to 200%)

  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebar: (open: boolean) => void;
  setRightSidebar: (open: boolean) => void;
  toggleFocus: (nodeId: string | null) => void;
  toggleRateUnit: () => void;
  setImplicitSearch: (state: UIState["implicitSearch"] | null) => void;
  setIconMapperOpen: (open: boolean) => void;
  setWindEfficiency: (efficiency: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // 1. [Visibility Toggles]
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  rateUnit: "per_minute",
  implicitSearch: null,
  iconMapperOpen: false,
  windEfficiency: 1.0,
  toggleLeftSidebar: () =>
    set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
  toggleRightSidebar: () =>
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
  setLeftSidebar: (open) => set({ leftSidebarOpen: open }),
  setRightSidebar: (open) => set({ rightSidebarOpen: open }),
  toggleRateUnit: () =>
    set((state) => ({
      rateUnit: state.rateUnit === "per_second" ? "per_minute" : "per_second",
    })),
  setImplicitSearch: (implicitSearch) => set({ implicitSearch }),
  setIconMapperOpen: (iconMapperOpen) => set({ iconMapperOpen }),
  setWindEfficiency: (windEfficiency) => set({ windEfficiency }),

  // 2. [Deep Focus Mode] - Managed separately from selection
  focusedNodeId: null,
  toggleFocus: (nodeId) =>
    set((state) => ({
      focusedNodeId: state.focusedNodeId === nodeId || !nodeId ? null : nodeId,
    })),
}));
