import { Block, Size, Port, InternalLayout } from '@/types/block';

// Constants for Schematic Layout
const PORT_ROW_HEIGHT = 45; // Increased slightly for spacing
const MIN_WIDTH = 380;

/**
 * Calculates the visual dimensions of a block based on its content.
 * This ensures the block grows to fit all ports.
 */
export function calculateBlockDimensions(
    inputCount: number,
    outputCount: number,
    machineCount: number
): { size: Size } {

    // UI STRUCTURE AUDIT:
    // 1. Header (Name + Rate Input) = ~75px
    // 2. Machine/Proliferator Bar = ~50px
    //    --> TOTAL TOP FIXED = 125px

    // 3. Middle Body (Ports + Machine Count)
    //    - Depends on max ports.
    //    - Min height for the Centered Big Number = ~140px

    // 4. Footer (Status Bar) = ~45px

    // TOTAL MIN HEIGHT NEEDS TO BE ~310px to be safe.

    const TOP_FIXED_HEIGHT = 110;
    const BOTTOM_FIXED_HEIGHT = 40;

    const maxPorts = Math.max(inputCount, outputCount);
    const GAP = 10;
    const portHeight = (maxPorts * PORT_ROW_HEIGHT) + (Math.max(0, maxPorts - 1) * GAP);

    // Ensure the middle section is at least tall enough for the graphics
    const middleHeight = Math.max(portHeight, 50);

    const height = TOP_FIXED_HEIGHT + middleHeight + BOTTOM_FIXED_HEIGHT;

    return {
        size: { width: MIN_WIDTH, height }
    };
}
