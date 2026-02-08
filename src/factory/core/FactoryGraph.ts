/**
 * ROLE: Domain Model (Manager)
 * PURPOSE: Manages the factory layout, blocks, and connections.
 * RELATION: The single source of truth for the Factory State.
 */

import { BlockBase } from "./BlockBase";
import { ProductionBlock } from "../blocks/ProductionBlock";
import { LogisticsBlock } from "../blocks/LogisticsBlock";
import { GathererBlock } from "../blocks/GathererBlock";
import { FactoryLayout, Connection, FactoryBlock } from "./factory.types";

export class FactoryGraph {
  blocks: Map<string, BlockBase> = new Map();
  connections: Connection[] = [];
  layoutMetadata: {
    beltYPositions: Map<string, { y: number; h: number }>; // key: "belt-{rank}-{itemId}-{slId}"
    blockBounds: Map<
      number,
      Array<{ blockId: string; y: number; height: number }>
    >;
    safeCorridors: Map<string, number>; // connectionId -> safeY
  } = {
    beltYPositions: new Map(),
    blockBounds: new Map(),
    safeCorridors: new Map(),
  };

  constructor() {
    // Empty initialization
  }

  /**
   * Creates and adds a new production block.
   */
  addBlock(name: string, x: number, y: number): ProductionBlock {
    const id = crypto.randomUUID();
    const block = new ProductionBlock(id, name, x, y);
    this.blocks.set(id, block);
    return block;
  }

  addLogistics(x: number, y: number): LogisticsBlock {
    const id = crypto.randomUUID();
    const block = new LogisticsBlock(id, x, y);
    this.blocks.set(id, block);
    return block;
  }

  addGatherer(name: string, x: number, y: number): GathererBlock {
    const id = crypto.randomUUID();
    const block = new GathererBlock(id, name, x, y);
    this.blocks.set(id, block);
    return block;
  }

  moveBlock(id: string, x: number, y: number) {
    const block = this.blocks.get(id);
    if (block) {
      block.position = { x, y };
    }
  }

  removeBlock(id: string) {
    // 1. Identify connections that will be removed
    const connectionsToRemove = this.connections.filter(
      (c) => c.sourceBlockId === id || c.targetBlockId === id
    );

    // 2. Explicitly remove each connection
    connectionsToRemove.forEach((c) => {
      this.removeConnection(c.id);
    });

    // 3. Remove the block itself
    this.blocks.delete(id);
  }

  removeConnection(id: string) {
    // Simply remove the connection without auto-simplifying junctions
    this.connections = this.connections.filter((c) => c.id !== id);
  }

  /**
   * Connects two blocks with a directional flow of an item.
   * Simplified: No longer auto-splits or forwards connections down a chain.
   */
  connect(sourceId: string, targetId: string, itemId: string) {
    if (!this.blocks.has(sourceId) || !this.blocks.has(targetId)) return;
    if (sourceId === targetId) return;

    // Prevent double-up
    const exists = this.connections.some(
      (c) =>
        c.sourceBlockId === sourceId &&
        c.targetBlockId === targetId &&
        c.itemId === itemId
    );
    if (exists) return;

    // Direct Connection only
    const connection: Connection = {
      id: crypto.randomUUID(),
      sourceBlockId: sourceId,
      targetBlockId: targetId,
      itemId,
      beltId: "conveyor-belt-mk-i",
      demand: 0,
      rate: 0,
    };
    this.connections.push(connection);
  }

  /**
   * Serializes the entire factory layout to the DTO for the solver.
   */
  toDTO(): FactoryLayout {
    const blockDict: Record<string, FactoryBlock> = {};
    this.blocks.forEach((block, id) => {
      blockDict[id] = block.toDTO();
    });

    return {
      blocks: blockDict,
      connections: [...this.connections],
    };
  }

  /**
   * Absorbs the calculated rates back into the Object Model.
   */
  syncFromDTO(dto: FactoryLayout) {
    // Sync Connections
    this.connections = dto.connections;

    // Sync Block Rates
    Object.values(dto.blocks).forEach((blockData) => {
      const block = this.blocks.get(blockData.id);
      if (block) {
        block.syncState(blockData);
      }
    });
  }
}
