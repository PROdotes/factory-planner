import { Node } from 'reactflow';
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
    collisionRects?: any[];
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

    /** Calculation mode: output driven or machine count driven */
    calculationMode: 'output' | 'machines';

    /** Target output rate (items per minute) */
    targetRate: number;

    /** Target number of machines (when mode is 'machines') */
    targetMachineCount?: number;

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

// ─── Splitters ──────────────────────────────────────────────

export interface SplitterNodeData {
    id: string;
    size?: Size;
    type: 'splitter' | 'merger' | 'balancer';

    // Splitters are simpler than blocks - strict 1:2 or 2:1 mapping usually
    // But we keep the generic port structure for consistency
    inputPorts: Port[];
    outputPorts: Port[];

    priority: 'balanced' | 'in-left' | 'in-right' | 'out-left' | 'out-right';
    filterItemId?: string; // If filtered, which item (usually on priority output)
}

export interface BlockNode extends Node<Block | SplitterNodeData> {
    origin?: [number, number];
}

export const BLOCK_LAYOUT = {
    HEADER: 98,
    WIDTH: 350,
    HEADER_TOP_HEIGHT: 64,
    HEADER_CONTROLS_HEIGHT: 34,
    PADDING: 10,
    PORT_LABEL: 24,
    PORT_ROW: 40,
    PORT_GAP: 10,
    FOOTER: 30,
    HANDLE_OFFSET: 4, // The 4px the handle pokes out
    CENTER_BODY_MIN_HEIGHT: 46 // Height of the "Required" box area
};

import { XYPosition } from 'reactflow';

/**
 * Calculate absolute position of a port on canvas.
 */
export function getPortPosition(
    nodeData: Block | SplitterNodeData,
    nodePosition: XYPosition,
    port: Port
): XYPosition {
    const width = (nodeData as any).size?.width || 80;
    const height = (nodeData as any).size?.height || 80;
    const { x, y } = nodePosition;

    // Splitter Logic
    if (!('recipeId' in nodeData)) {
        const splitterX = port.side === 'left' ? x - BLOCK_LAYOUT.HANDLE_OFFSET : x + width + BLOCK_LAYOUT.HANDLE_OFFSET;
        return { x: splitterX, y: y + height * port.offset };
    }

    // Building Logic
    const { HEADER, PORT_LABEL, PORT_ROW, PORT_GAP, HANDLE_OFFSET } = BLOCK_LAYOUT;

    switch (port.side) {
        case 'top': return { x: x + width * port.offset, y: y - HANDLE_OFFSET };
        case 'bottom': return { x: x + width * port.offset, y: y + height + HANDLE_OFFSET };
        case 'left':
        case 'right': {
            const ports = port.type === 'input' ? nodeData.inputPorts : nodeData.outputPorts;
            const index = ports.findIndex(p => p.id === port.id);
            const safeIndex = index === -1 ? 0 : index;

            const topOffset = HEADER + PORT_LABEL;
            const rowCenter = topOffset + (safeIndex * (PORT_ROW + PORT_GAP)) + (PORT_ROW / 2);

            const buildingX = port.side === 'left' ? x - HANDLE_OFFSET : x + width + HANDLE_OFFSET;
            return { x: buildingX, y: y + rowCenter };
        }
    }
    return { x, y };
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
