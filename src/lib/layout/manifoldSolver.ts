import { Size } from '@/types/block';
import { BLOCK_LAYOUT } from '@/types/block';

/**
 * Calculates the visual dimensions of a block based on its content.
 * This ensures the block grows to fit all ports.
 */
export function calculateBlockDimensions(
    inputCount: number,
    outputCount: number
): { size: Size } {
    const count = Math.max(inputCount, outputCount, 1);
    const midHeight = BLOCK_LAYOUT.PORT_LABEL + (count * BLOCK_LAYOUT.PORT_ROW) + (Math.max(0, count - 1) * BLOCK_LAYOUT.PORT_GAP);

    const height = BLOCK_LAYOUT.HEADER + BLOCK_LAYOUT.PADDING + midHeight + BLOCK_LAYOUT.PADDING + BLOCK_LAYOUT.FOOTER;

    return {
        size: { width: 380, height }
    };
}
