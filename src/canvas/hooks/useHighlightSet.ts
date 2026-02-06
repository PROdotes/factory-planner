/**
 * ROLE: Logic Abstractor (Interaction Layer)
 * PURPOSE: Unifies Selection Context and Focus Context into a single visual truth.
 * RELATION: Used by components to decide 'Am I Dimmed?'.
 */

import { useMemo } from 'react';
import { useFactoryStore } from '../../factory/factoryStore';
import { useUIStore } from '../uiStore';
import { useGameDataStore } from '../../gamedata/gamedataStore';
import { getFocusSet, getNeighborSet } from '../../solver/graphTraversal';
import { ProductionBlock } from '../../factory/blocks/ProductionBlock';

export function useHighlightSet() {
    const focusedId = useUIStore(s => s.focusedNodeId);
    const selectedId = useFactoryStore(s => s.selectedBlockId);
    const factory = useFactoryStore(s => s.factory);
    const recipes = useGameDataStore(s => s.recipes);

    return useMemo(() => {
        // 1. [Contextual Priority] - Selection Overrides
        // If a machine is selected, show its local neighborhood (the "Shallow" drill-down).
        if (selectedId) {
            const block = factory.blocks.get(selectedId);
            if (!block) return { blocks: new Set<string>(), outputItems: new Set<string>(), connectedInputs: new Map<string, Set<string>>() };

            // Get outputs from the RECIPE (not connections)
            const outputItems = new Set<string>();
            if (block instanceof ProductionBlock && block.recipeId) {
                const recipe = recipes[block.recipeId];
                if (recipe) {
                    recipe.outputs.forEach(out => outputItems.add(out.itemId));
                }
            }

            // Track which items flow into which blocks via CONNECTIONS from this block
            const connectedInputs = new Map<string, Set<string>>();
            for (const conn of factory.connections) {
                if (conn.sourceBlockId === selectedId) {
                    if (!connectedInputs.has(conn.targetBlockId)) {
                        connectedInputs.set(conn.targetBlockId, new Set());
                    }
                    connectedInputs.get(conn.targetBlockId)!.add(conn.itemId);
                }
            }

            return {
                blocks: getNeighborSet(selectedId, factory.toDTO()),
                outputItems,
                connectedInputs
            };
        }

        // 2. [Big Picture Priority] - Deep Focus
        // If nothing is selected but Deep Focus is Active, it defines the world.
        if (focusedId) {
            return {
                blocks: getFocusSet(focusedId, factory.toDTO()),
                outputItems: new Set<string>(),
                connectedInputs: new Map<string, Set<string>>()
            };
        }

        // 3. [Default] - Maximum clarity (No dimming).
        return { blocks: new Set<string>(), outputItems: new Set<string>(), connectedInputs: new Map<string, Set<string>>() };
    }, [focusedId, selectedId, factory, recipes]);
}
