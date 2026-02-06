/**
 * UI state (not persisted with layout).
 */
export interface UIState {
    /** Currently selected items */
    selection: Selection;

    /** Active modal/dialog */
    modal: ModalState | null;

    /** Active tool */
    tool: ToolType;

    /** View options */
    view: ViewOptions;
}

export interface Selection {
    blockIds: string[];
    connectionIds: string[];
    containerId?: string;
}

export type ToolType =
    | 'select' // Default, click to select
    | 'pan' // Drag to pan
    | 'connect' // Click ports to connect
    | 'add-block'; // Click to place new block

export interface ViewOptions {
    /** Show internal layouts */
    showInternals: boolean;

    /** Show belt utilization colors */
    showCapacity: boolean;

    /** Show direction labels */
    showDirections: boolean;

    /** Show grid */
    showGrid: boolean;

    /** Grid snap */
    snapToGrid: boolean;
}

// ─── Modal States ──────────────────────────────────────

export type ModalState =
    | { type: 'recipe-picker'; onSelect: (recipeId: string) => void }
    | { type: 'rate-input'; recipeId: string; onConfirm: (rate: number) => void }
    | { type: 'settings' }
    | { type: 'save-layout' }
    | { type: 'load-layout' }
    | { type: 'export' };
