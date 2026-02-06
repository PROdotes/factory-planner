import { Size, BLOCK_LAYOUT } from '@/types/block';

/**
 * Calculates the visual dimensions of a block based on its content.
 * This ensures the block grows to fit all ports.
 */
export function calculateBlockDimensions(
    inputCount: number,
    outputCount: number
): { size: Size } {
    const count = Math.max(inputCount, outputCount, 1);
    const portsHeight = (count * BLOCK_LAYOUT.PORT_ROW) + (Math.max(0, count - 1) * BLOCK_LAYOUT.PORT_GAP);
    const midHeight = BLOCK_LAYOUT.PORT_LABEL + portsHeight;

    const height = BLOCK_LAYOUT.HEADER + midHeight + BLOCK_LAYOUT.PADDING + BLOCK_LAYOUT.FOOTER;

    return {
        size: { width: BLOCK_LAYOUT.WIDTH, height }
    };
}
