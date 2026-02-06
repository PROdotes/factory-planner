/**
 * Complete definition of a game's production mechanics.
 * DSP is the default, but structure supports Factorio/Satisfactory.
 */
export interface GameDefinition {
    id: GameId;
    name: string; // "Dyson Sphere Program"
    version: string; // Game version this data is for

    items: Item[];
    recipes: Recipe[];
    machines: Machine[];
    belts: BeltTier[];

    /** Sprite sheet configuration for icons */
    spriteSheet?: {
        url: string;
        columns: number;
    };

    // Game-specific quirks
    settings: GameSettings;
}

export type GameId = 'dsp' | 'factorio' | 'satisfactory';
export type RateUnit = 'second' | 'minute';

export interface GameSettings {
    /** Number of lanes per belt (DSP=1, Satisfactory=2) */
    lanesPerBelt: number;

    /** Whether machines have variable speed (proliferator, modules) */
    hasSpeedModifiers: boolean;

    /** Base unit for rates: 'second' or 'minute' */
    rateUnit: RateUnit;

    /** Grid size for layout calculations */
    gridSize: number;

    /** Default machine selections by category (optional) */
    defaultMachineIds?: Partial<Record<RecipeCategory, string>>;
}

export type ItemCategory =
    | 'ore'
    | 'ingot'
    | 'component'
    | 'product'
    | 'science'
    | 'fluid' // For games with pipes
    | 'other';

/**
 * Any item that can be transported on belts.
 */
export interface Item {
    id: string; // "iron-ore", "copper-plate"
    name: string; // "Iron Ore"
    category: ItemCategory;
    stackSize: number; // For inventory, not belt capacity
    icon?: string; // Path to icon image

    /** Is this a user-created item? */
    isCustom?: boolean;

    /** Optional color override for port icons */
    color?: string;

    /** Index in the sprite sheet */
    iconIndex?: number;
}

export type RecipeCategory =
    | 'smelting'
    | 'assembling'
    | 'refining'
    | 'chemical'
    | 'research'
    | 'mining'
    | 'other';

export interface RecipePort {
    itemId: string;
    amount: number; // Per craft cycle

    /** Probability for outputs (byproducts), defaults to 1.0 */
    probability?: number;
}

/**
 * A production recipe that transforms inputs into outputs.
 */
export interface Recipe {
    id: string; // "iron-plate"
    name: string; // "Iron Plate"

    /** Which machine type processes this */
    machineId: string; // Default machine ("arc-smelter")

    /** Items consumed per craft */
    inputs: RecipePort[];

    /** Items produced per craft */
    outputs: RecipePort[];

    /** Time for one craft cycle (seconds) */
    craftingTime: number; // 1.0 = 1 second

    /** Category for filtering in recipe picker */
    category: RecipeCategory;

    /** Is this a user-created recipe? */
    isCustom?: boolean;

    /** User notes */
    notes?: string;
}

/**
 * Calculated recipe rates (derived, not stored)
 */
export interface RecipeRates {
    /** Items per minute per machine (at 100% speed) */
    inputsPerMinute: { itemId: string; rate: number }[];
    outputsPerMinute: { itemId: string; rate: number }[];
}

export type MachineCategory =
    | 'smelter'
    | 'assembler'
    | 'refinery'
    | 'chemical'
    | 'lab'
    | 'miner'
    | 'other';

/**
 * A production machine that processes recipes.
 */
export interface Machine {
    id: string; // "arc-smelter"
    name: string; // "Arc Smelter"
    category: MachineCategory;

    /** Base crafting speed multiplier (1.0 = normal) */
    speed: number; // Arc Smelter = 1.0, Mk2 = 2.0

    /** Physical footprint for internal layout */
    size: {
        width: number; // Grid units
        height: number;
    };

    /** Power consumption (watts) - for future features */
    powerUsage?: number;

    icon?: string;

    /** Is this a user-created machine? */
    isCustom?: boolean;

    /** Allowed recipe categories (for editor validation) */
    allowedCategories?: RecipeCategory[];
}

/**
 * A belt tier with specific throughput capacity.
 */
export interface BeltTier {
    id: string; // "belt-mk1"
    name: string; // "Conveyor Belt Mk.I"
    tier: number; // 1, 2, 3 (for sorting)

    /** Items per second throughput */
    itemsPerSecond: number; // DSP: Mk1=6, Mk2=12, Mk3=30

    /** Color for visualization */
    color: string; // "#666", "#88f", "#f80"

    /** Height in pixels for Standard view belt stacking */
    visualHeight?: number;

    icon?: string;
}

/**
 * Calculated: items per minute (more intuitive for users)
 */
export function beltItemsPerMinute(belt: BeltTier): number {
    return belt.itemsPerSecond * 60;
}
