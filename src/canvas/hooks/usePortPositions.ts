/**
 * ROLE: UI Hook (Geometry)
 * PURPOSE: Calculates port positions on left/right edges of block.
 * RELATION: Used by BlockCard to render ports and by ConnectionLines for routing.
 */

import { useMemo } from 'react';
import { useGameDataStore } from '../../gamedata/gamedataStore';
import { BlockBase } from '../../factory/core/BlockBase';
import { ProductionBlock } from '../../factory/blocks/ProductionBlock';
import { FLOW_CONFIG } from '../LayoutConfig';

export interface PortDescriptor {
    side: 'left' | 'right';
    itemId: string;
    y: number;  // Y offset from top of card
}

export function usePortPositions(block: BlockBase) {
    const { recipes } = useGameDataStore();

    return useMemo(() => {
        const ports: PortDescriptor[] = [];
        const { PORT_VERTICAL_SPACING, HEADER_HEIGHT, CONTROLS_HEIGHT, BORDER_WIDTH } = FLOW_CONFIG;

        // Logical Start: Header + Border + Controls
        const PORT_CONTENT_START = HEADER_HEIGHT + BORDER_WIDTH + CONTROLS_HEIGHT;

        let inputItems: string[] = [];
        let outputItems: string[] = [];

        if (block instanceof ProductionBlock) {
            const recipeId = block.recipeId;
            const recipe = recipeId ? recipes[recipeId] : null;

            if (recipe) {
                inputItems = recipe.inputs.map(i => i.itemId);
                outputItems = recipe.outputs.map(i => i.itemId);
            }
        } else if (block.type === 'sink') {
            inputItems = Object.keys(block.demand);
        } else if (block.type === 'logistics') {
            const items = Object.keys(block.demand);
            const itemId = items[0] || 'unknown';
            inputItems = [itemId];
            outputItems = [itemId];
        }

        const rowCenterOffset = PORT_VERTICAL_SPACING / 2;

        // Right side (Outputs) consistently on top
        outputItems.forEach((itemId, i) => {
            ports.push({
                side: 'right',
                itemId,
                y: PORT_CONTENT_START + i * PORT_VERTICAL_SPACING + rowCenterOffset
            });
        });

        // Left side (Inputs) start AFTER the last output row
        inputItems.forEach((itemId, i) => {
            const rowOffset = i + outputItems.length;
            ports.push({
                side: 'left',
                itemId,
                y: PORT_CONTENT_START + rowOffset * PORT_VERTICAL_SPACING + rowCenterOffset
            });
        });

        return ports;
    }, [block, recipes]);
}

/**
 * Get the Y offset for a specific port.
 */
export function getPortOffset(ports: PortDescriptor[], side: 'left' | 'right', itemId: string): number {
    const port = ports.find(p => p.side === side && p.itemId === itemId);
    const fallback = FLOW_CONFIG.HEADER_HEIGHT + FLOW_CONFIG.BORDER_WIDTH + FLOW_CONFIG.CONTROLS_HEIGHT;
    return port ? port.y : fallback;
}
