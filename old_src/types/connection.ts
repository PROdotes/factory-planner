import { Position } from './block';

/**
 * A belt connection between two blocks.
 * This is the CORE of the physical routing visualization.
 */
export interface BeltConnection {
    id: string;

    /** Source block and port */
    from: ConnectionEndpoint;

    /** Destination block and port */
    to: ConnectionEndpoint;

    /** Belt tier used for this connection */
    beltTierId: string;

    /** Routing path with waypoints */
    path: PathSegment[];

    /** Split points where belt divides */
    splits: SplitPoint[];

    // ─── Calculated ──────────────────────────────────────

    /** How full is this belt? (0.0 to 1.0+) */
    utilization: number;

    /** Warnings/errors for this connection */
    issues: ConnectionIssue[];

    /** Labels for direction/utilization */
    labels?: { text: string; position: Position; rotation: number }[];
}

export interface ConnectionEndpoint {
    blockId: string;
    portId: string;
}

// ─── Path Segments ──────────────────────────────────────

/**
 * A segment of a belt path.
 * The path is broken into segments to show direction and annotations.
 */
export interface PathSegment {
    /** Start point */
    from: Position;

    /** End point */
    to: Position;

    /** Direction of travel */
    direction: Direction;

    /** Type of segment */
    type: SegmentType;

    /** What item(s) flow through (for lane-level detail) */
    lanes: LaneContent[];
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export type SegmentType =
    | 'straight' // Normal belt
    | 'turn' // 90-degree turn
    | 'underground' // Goes under something
    | 'bridge' // Goes over something
    | 'split-out' // Belt splitting
    | 'merge-in'; // Belt merging

export interface LaneContent {
    lane: number; // 0, 1, etc.
    itemId: string;
    rate: number; // Items/min on this lane
}

// ─── Split Points ──────────────────────────────────────

/**
 * A point where a belt splits into multiple destinations.
 * Critical for the "split here, route east" visualization.
 */
export interface SplitPoint {
    id: string;

    /** Position on canvas */
    position: Position;

    /** Incoming belt */
    incomingRate: number; // Total items/min arriving

    /** Where it splits to */
    outputs: SplitOutput[];

    /** User annotation (e.g., "Main bus tap") */
    label?: string;
}

export interface SplitOutput {
    /** Direction this output goes */
    direction: Direction;

    /** Target block (for labeling) */
    targetBlockId: string;

    /** Rate going this way */
    rate: number;

    /** Percentage of incoming */
    percentage: number; // 0.0 to 1.0
}

// ─── Connection Issues ──────────────────────────────────────

/**
 * Problems detected with a connection.
 */
export interface ConnectionIssue {
    type: IssueType;
    severity: 'warning' | 'error';
    message: string;

    /** Position where issue occurs (for highlighting) */
    position?: Position;
}

export type IssueType =
    | 'over-capacity' // Belt can't handle the rate
    | 'crossing' // Path crosses another belt
    | 'pass-through' // Needs to go through another block's area
    | 'dead-end' // Connection doesn't reach destination
    | 'item-mismatch'; // Wrong item type

/** Production loop info (derived during validation) */
export interface LoopInfo {
    itemIds: string[];
    blockIds: string[];
    netProduction: number;
}
