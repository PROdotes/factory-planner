/**
 * ROLE: Logic Abstractor (Interaction Layer)
 * PURPOSE: Unifies Selection Context and Focus Context into a single visual truth.
 * RELATION: Used by components to decide 'Am I Dimmed?'.
 */

import { useMemo } from "react";
import { useFactoryStore } from "../../factory/factoryStore";
import { useUIStore } from "../uiStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { getFocusSet, getNeighborSet } from "../../solver/graphTraversal";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";

export interface HighlightSet {
  blocks: Set<string>;
  outputItems: Set<string>;
  connectedInputs: Map<string, Set<string>>;
  connectedOutputs: Map<string, Set<string>>;
}

export function useHighlightSet(): HighlightSet {
  const focusedId = useUIStore((s) => s.focusedNodeId);
  const selectedId = useFactoryStore((s) => s.selectedBlockId);
  const factory = useFactoryStore((s) => s.factory);
  const recipes = useGameDataStore((s) => s.recipes);

  return useMemo(() => {
    const emptySet = (): HighlightSet => ({
      blocks: new Set(),
      outputItems: new Set(),
      connectedInputs: new Map(),
      connectedOutputs: new Map(),
    });

    // 1. [Contextual Priority] - Selection Overrides
    // If a machine is selected, show its local neighborhood (the "Shallow" drill-down).
    if (selectedId) {
      const block = factory.blocks.get(selectedId);
      if (!block) return emptySet();

      // Get outputs from the RECIPE (not connections)
      const outputItems = new Set<string>();
      if (block instanceof ProductionBlock && block.recipeId) {
        const recipe = recipes[block.recipeId];
        if (recipe) {
          recipe.outputs.forEach((out) => outputItems.add(out.itemId));
        }
      }

      // Track logical flow across junctions to highlight machine ports
      const connectedInputs = new Map<string, Set<string>>(); // targetBlockId -> Set<itemIds>
      const connectedOutputs = new Map<string, Set<string>>(); // sourceBlockId -> Set<itemIds>

      const traceForward = (startId: string, itemId: string) => {
        const queue = [startId];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const cid = queue.shift()!;
          if (visited.has(cid)) continue;
          visited.add(cid);
          factory.connections.forEach((c) => {
            if (c.sourceBlockId === cid && c.itemId === itemId) {
              const target = factory.blocks.get(c.targetBlockId);
              if (target?.type === "logistics") queue.push(c.targetBlockId);
              else {
                if (!connectedInputs.has(c.targetBlockId))
                  connectedInputs.set(c.targetBlockId, new Set());
                connectedInputs.get(c.targetBlockId)!.add(itemId);
              }
            }
          });
        }
      };

      const traceBackward = (startId: string, itemId: string) => {
        const queue = [startId];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const cid = queue.shift()!;
          if (visited.has(cid)) continue;
          visited.add(cid);
          factory.connections.forEach((c) => {
            if (c.targetBlockId === cid && c.itemId === itemId) {
              const source = factory.blocks.get(c.sourceBlockId);
              if (source?.type === "logistics") queue.push(c.sourceBlockId);
              else {
                if (!connectedOutputs.has(c.sourceBlockId))
                  connectedOutputs.set(c.sourceBlockId, new Set());
                connectedOutputs.get(c.sourceBlockId)!.add(itemId);
              }
            }
          });
        }
      };

      // 1. Trace outgoing from selected block
      const outgoingItems = new Set<string>();
      factory.connections.forEach((c) => {
        if (c.sourceBlockId === selectedId) outgoingItems.add(c.itemId);
      });
      outgoingItems.forEach((id) => traceForward(selectedId, id));

      // 2. Trace incoming to selected block
      const incomingItems = new Set<string>();
      factory.connections.forEach((c) => {
        if (c.targetBlockId === selectedId) incomingItems.add(c.itemId);
      });
      incomingItems.forEach((id) => traceBackward(selectedId, id));

      return {
        blocks: getNeighborSet(selectedId, factory.toDTO()),
        outputItems, // The selected block's own icons
        connectedInputs,
        connectedOutputs,
      };
    }

    // 2. [Big Picture Priority] - Deep Focus
    if (focusedId) {
      return {
        blocks: getFocusSet(focusedId, factory.toDTO()),
        outputItems: new Set(),
        connectedInputs: new Map(),
        connectedOutputs: new Map(),
      };
    }

    // 3. [Default]
    return emptySet();
  }, [focusedId, selectedId, factory, recipes]);
}
