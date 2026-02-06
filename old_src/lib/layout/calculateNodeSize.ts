import { BlockNode, getCalculatedSize } from '@/types/block';
import { GameDefinition } from '@/types/game';

/**
 * Calculates the current pixel size of a node based on its type, data, and view mode.
 */
export function calculateNodeSize(node: BlockNode, flowMode: boolean, game?: GameDefinition): { width: number; height: number } {
    return getCalculatedSize(node.data, flowMode, game);
}
