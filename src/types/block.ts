export type PortSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * An input or output connection point on a block.
 */
export interface Port {
    id: string; // Unique within block
    type: 'input' | 'output';

    /** Which item flows through this port */
    itemId: string;

    /** Rate in items per minute */
    rate: number;

    /** Which side of the block */
    side: PortSide;

    /** Offset along that side (0 = start, 1 = end) */
    offset: number; // 0.0 to 1.0

    /** Which belt lanes this uses (for multi-lane games) */
    lanes?: number[]; // [0], [1], [0, 1]

    /** 
     * Actual flow rate after upstream starvation/constraints.
     * If undefined, assume == rate.
     */
    currentRate?: number;
}

export type EdgeStatus = 'ok' | 'bottleneck' | 'overload' | 'underload' | 'mismatch' | 'conflict';

export interface BeltEdgeData {
    beltId: string;
    flowRate: number; // Actual items/min currently flowing
    demandRate: number; // What the consumer actually needs/requests
    capacity: number; // Max items/min for this belt tier
    status: EdgeStatus;
    itemId: string;
}

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

/**
 * A production block - the core building unit.
 * Represents a self-contained production setup (e.g., "6 smelters making iron plates").
 */
export interface Block {
    id: string; // Unique ID (UUID)
    name: string; // User-editable label

    /** Recipe this block produces */
    recipeId: string;

    /** Machine variant for this block (optional override) */
    machineId?: string; // "arc-smelter-mk2"

    /** Target output rate (items per minute) */
    targetRate: number;

    /** Position on canvas */
    position: Position;

    /** Visual size (calculated from machine count) */
    size: Size;

    // ─── Calculated Fields ───────────────────────────────

    /** Number of machines needed to hit target rate */
    machineCount: number;

    /** Actual output rate (may differ due to rounding) */
    actualRate: number;

    /** Input ports (items this block needs) */
    inputPorts: Port[];

    /** Output ports (items this block produces) */
    outputPorts: Port[];

    // ─── Optional ────────────────────────────────────────

    /** Internal layout (shown when expanded) */
    internalLayout?: InternalLayout;

    /** Machine speed modifier (proliferator, etc.) */
    speedModifier?: number; // 1.0 = 100%, 1.25 = 125%

    /** User notes */
    notes?: string;

    /** For byproduct recipes: primary output item */
    primaryOutputId?: string;

    /** Speed/productivity modifier settings */
    modifier?: {
        type: 'none' | 'speed' | 'productivity';
        level: number;
        includeConsumption: boolean;
    };

    /** Production loop identifier, if applicable */
    loopId?: string;

    /** Room/floor this block belongs to */
    containerId?: string;

    /** Calculated production efficiency (0.0 to 1.0) */
    efficiency: number;
}

/**
 * Calculate absolute position of a port on canvas.
 */
export function getPortPosition(block: Block, port: Port): Position {
    const { x, y } = block.position;
    const { width, height } = block.size;

    switch (port.side) {
        case 'top':
            return { x: x + width * port.offset, y: y };
        case 'bottom':
            return { x: x + width * port.offset, y: y + height };
        case 'left':
            return { x: x, y: y + height * port.offset };
        case 'right':
            return { x: x + width, y: y + height * port.offset };
    }
}

// ─── Internal Layout ────────────────────────────────────────

/**
 * How machines are arranged inside a block (expandable view).
 */
export interface InternalLayout {
    /** Machine positions within the block */
    machines: MachinePlacement[];

    /** Internal belt routing */
    internalBelts: InternalBelt[];

    /** Overall arrangement pattern */
    pattern: LayoutPattern;
}

export interface MachinePlacement {
    index: number; // 0, 1, 2, ...
    position: Position; // Relative to block origin
    rotation: 0 | 90 | 180 | 270; // Degrees
}

export interface InternalBelt {
    fromMachine: number | 'input'; // Machine index or port
    toMachine: number | 'output';
    path: Position[]; // Waypoints
    itemId: string;
}

export type LayoutPattern =
    | 'linear' // Single row
    | 'double-row' // Two rows facing each other
    | 'grid' // Grid arrangement
    | 'custom'; // User-defined
