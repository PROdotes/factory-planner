import { Block, Position, Size } from './block';
import { BeltConnection, LoopInfo } from './connection';
import { GameId } from './game';

/**
 * A complete layout (saveable document).
 */
export interface Layout {
    id: string;
    name: string;
    gameId: GameId;

    /** All production blocks */
    blocks: Block[];

    /** All belt connections */
    connections: BeltConnection[];

    /** Organizational containers */
    containers: Container[];

    /** Canvas view state */
    viewport: Viewport;

    /** Metadata */
    meta: LayoutMeta;

    /** Detected production loops */
    loops?: LoopInfo[];
}

export interface LayoutMeta {
    createdAt: string; // ISO timestamp
    updatedAt: string;
    version: number; // For migrations
    author?: string;
    description?: string;
}

export interface Viewport {
    center: Position;
    zoom: number; // 1.0 = 100%
}

// ─── Containers (Rooms/Floors) ──────────────────────────────────────

/**
 * A container that groups blocks together.
 * Used for organizing large factories into rooms or floors.
 */
export interface Container {
    id: string;
    name: string; // "Floor 1", "Copper Processing"
    type: ContainerType;

    /** Position and size on canvas */
    bounds: {
        position: Position;
        size: Size;
    };

    /** Blocks inside this container */
    blockIds: string[];

    /** Nested containers (floors within buildings) */
    childIds: string[];

    /** Parent container, if nested */
    parentId?: string;

    /** Visual styling */
    color?: string;
    collapsed?: boolean; // Hide contents
}

export type ContainerType =
    | 'room' // Logical grouping
    | 'floor' // Vertical layer
    | 'building'; // Contains floors
