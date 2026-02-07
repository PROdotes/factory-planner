/**
 * ROLE: UI Hook (Geometry)
 * PURPOSE: Calculates port positions on left/right edges of block.
 * RELATION: Used by BlockCard to render ports and by ConnectionLines for routing.
 */

import { useMemo, useState, useEffect } from "react";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { BlockBase } from "../../factory/core/BlockBase";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { FLOW_CONFIG } from "../LayoutConfig";

export interface PortDescriptor {
  side: "left" | "right";
  itemId: string;
  y: number; // Y offset from top of card
}

import { useFactoryStore } from "../../factory/factoryStore";
import { getSortedPorts } from "../../factory/core/sortBlockPorts";

export function usePortPositions(
  block: BlockBase,
  version: number,
  overridePosition?: { x: number; y: number }
) {
  const { recipes } = useGameDataStore();
  const { factory } = useFactoryStore();

  // NEW: Track transient positions of neighbors to live-sort OUR ports when THEY move
  const [neighborOverrides, setNeighborOverrides] = useState<
    Map<string, { y: number }>
  >(new Map());

  // Filter relevant neighbors once
  const myNeighborIds = useMemo(() => {
    const ids = new Set<string>();
    factory.connections.forEach((c) => {
      if (c.sourceBlockId === block.id) ids.add(c.targetBlockId);
      if (c.targetBlockId === block.id) ids.add(c.sourceBlockId);
    });
    return ids;
  }, [block.id, factory.connections, version]);

  useEffect(() => {
    const onTransientMove = (e: any) => {
      const { id, y } = e.detail;
      if (myNeighborIds.has(id)) {
        setNeighborOverrides((prev) => {
          const next = new Map(prev);
          next.set(id, { y });
          return next;
        });
      }
    };

    window.addEventListener("block-transient-move", onTransientMove);
    return () =>
      window.removeEventListener("block-transient-move", onTransientMove);
  }, [myNeighborIds]);

  // Reset overrides when drag ends (version changes or overridePosition clears)
  useEffect(() => {
    if (!overridePosition && neighborOverrides.size > 0) {
      setNeighborOverrides(new Map());
    }
  }, [version, overridePosition]); // Simplify reset logic

  return useMemo(() => {
    const ports: PortDescriptor[] = [];
    const {
      PORT_VERTICAL_SPACING,
      HEADER_HEIGHT,
      CONTROLS_HEIGHT,
      BORDER_WIDTH,
    } = FLOW_CONFIG;

    // Logical Start: Header + Border + Controls
    const PORT_CONTENT_START = HEADER_HEIGHT + BORDER_WIDTH + CONTROLS_HEIGHT;

    let inputItems: string[] = [];
    let outputItems: string[] = [];

    const isProduction = block.type === "production";
    const recipeId = isProduction ? (block as ProductionBlock).recipeId : null;
    const recipe = recipeId ? recipes[recipeId] : null;

    if (isProduction && recipe) {
      inputItems = recipe.inputs.map((i) => i.itemId);
      outputItems = recipe.outputs.map((i) => i.itemId);
    } else if (isProduction && !recipe) {
      inputItems = Object.keys(block.demand);
    } else if (block.type === "logistics") {
      // HOLISTIC: Check connections first
      const connectedItem = factory.connections.find(
        (c) =>
          (c.sourceBlockId === block.id || c.targetBlockId === block.id) &&
          c.itemId !== "unknown"
      )?.itemId;

      const itemId =
        connectedItem ||
        Object.keys(block.demand).find((id) => id !== "unknown") ||
        "unknown";
      inputItems = [itemId];
      outputItems = [itemId];
    }

    let finalInputItems = inputItems;
    let finalOutputItems = outputItems;

    // Dynamic Sort Logic: Run if WE are moving OR if NEIGHBORS are moving
    if (overridePosition || neighborOverrides.size > 0) {
      // Live calculation during drag
      const result = getSortedPorts(
        block,
        factory,
        overridePosition?.y,
        neighborOverrides
      );
      finalInputItems = result.inputOrder;
      finalOutputItems = result.outputOrder;
    } else {
      // Use persisted order if available, else fallback to recipe natural order
      if (block.inputOrder && block.inputOrder.length > 0) {
        finalInputItems = block.inputOrder;
      }
      if (block.outputOrder && block.outputOrder.length > 0) {
        finalOutputItems = block.outputOrder;
      }
    }

    const rowCenterOffset = PORT_VERTICAL_SPACING / 2;

    // Right side (Outputs) consistently on top
    finalOutputItems.forEach((itemId, i) => {
      const y =
        block.type === "logistics"
          ? FLOW_CONFIG.JUNCTION_SIZE / 2
          : PORT_CONTENT_START + i * PORT_VERTICAL_SPACING + rowCenterOffset;
      ports.push({
        side: "right",
        itemId,
        y,
      });
    });

    // Left side (Inputs) start AFTER the last output row
    finalInputItems.forEach((itemId, i) => {
      const rowOffset = i + finalOutputItems.length;
      const y =
        block.type === "logistics"
          ? FLOW_CONFIG.JUNCTION_SIZE / 2
          : PORT_CONTENT_START +
            rowOffset * PORT_VERTICAL_SPACING +
            rowCenterOffset;
      ports.push({
        side: "left",
        itemId,
        y,
      });
    });

    return ports;
  }, [block, recipes, version, overridePosition, factory, neighborOverrides]);
}

/**
 * Get the Y offset for a specific port.
 */
export function getPortOffset(
  ports: PortDescriptor[],
  side: "left" | "right",
  itemId: string
): number {
  const port = ports.find((p) => p.side === side && p.itemId === itemId);
  const fallback =
    FLOW_CONFIG.HEADER_HEIGHT +
    FLOW_CONFIG.BORDER_WIDTH +
    FLOW_CONFIG.CONTROLS_HEIGHT;
  return port ? port.y : fallback;
}
