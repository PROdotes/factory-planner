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
    this.blocks.delete(id);
    // Clean up connections
    this.connections = this.connections.filter(
      (c) => c.sourceBlockId !== id && c.targetBlockId !== id
    );
  }

  removeConnection(id: string) {
    this.connections = this.connections.filter((c) => c.id !== id);
  }

  /**
   * Connects two blocks with a directional flow of an item.
   */
  connect(sourceId: string, targetId: string, itemId: string) {
    if (!this.blocks.has(sourceId)) {
      console.error(
        `Connect Failed: Source Block '${sourceId}' does not exist.`
      );
      return;
    }
    if (!this.blocks.has(targetId)) {
      console.error(
        `Connect Failed: Target Block '${targetId}' does not exist.`
      );
      return;
    }

    // Prevent double-up: Check if this exact connection already exists
    const exists = this.connections.some(
      (c) =>
        c.sourceBlockId === sourceId &&
        c.targetBlockId === targetId &&
        c.itemId === itemId
    );
    if (exists) {
      console.warn(
        `[GRAPH] Skipping duplicate connection: ${sourceId} -> ${targetId} (${itemId})`
      );
      return;
    }

    console.log(
      `[GRAPH] Adding connection: ${sourceId} -> ${targetId} (${itemId})`
    );

    // --- [AUTO-SPLITTER LOGIC] ---
    // Check if this source-item pair already has an outgoing connection
    const existingConnection = this.connections.find(
      (c) => c.sourceBlockId === sourceId && c.itemId === itemId
    );

    const sourceBlock = this.blocks.get(sourceId);
    if (!sourceBlock) return; // Should have been caught earlier but safe to check

    // If there is an existing connection, AND the source is not already a logistics block (splitter)
    if (
      existingConnection &&
      sourceBlock?.type !== "logistics" &&
      existingConnection.targetBlockId !== targetId
    ) {
      console.log("[GRAPH] Auto-Inserting Splitter due to overload...");

      // 1. Identify the topology
      const oldTargetId = existingConnection.targetBlockId;
      const oldTargetBlock = this.blocks.get(oldTargetId);
      const newTargetBlock = this.blocks.get(targetId);

      if (!oldTargetBlock || !newTargetBlock) return;

      // 2. Calculate Splitter Position (Midpoint-ish, but closer to source to avoid mess)
      // Actually, let's put it fairly close to the source to simulate a "bus tap" or "manifold start"
      const sx = sourceBlock.position.x;
      const sy = sourceBlock.position.y;
      const tx1 = oldTargetBlock.position.x;
      const ty1 = oldTargetBlock.position.y;
      const tx2 = newTargetBlock.position.x;
      const ty2 = newTargetBlock.position.y;

      // Weighted average: 60% Source, 20% T1, 20% T2
      const splitX = sx * 0.6 + tx1 * 0.2 + tx2 * 0.2;
      const splitY = sy * 0.6 + ty1 * 0.2 + ty2 * 0.2;

      // 3. Create the Splitter (Logistics Block)
      const splitterParams = this.addLogistics(splitX, splitY); // Returns { id, ... }
      const splitterId = splitterParams.id; // Corrected access

      // 4. Remove the old connection (Source -> OldTarget)
      this.connections = this.connections.filter(
        (c) => c.id !== existingConnection.id
      );

      // 5. Wire up the T-Junction
      // Source -> Splitter
      this.connections.push({
        id: crypto.randomUUID(),
        sourceBlockId: sourceId,
        targetBlockId: splitterId,
        itemId,
        beltId: "conveyor-belt-mk-i",
        demand: 0,
        rate: 0,
      });

      // Splitter -> Old Target
      this.connections.push({
        id: crypto.randomUUID(),
        sourceBlockId: splitterId,
        targetBlockId: oldTargetId,
        itemId,
        beltId: "conveyor-belt-mk-i",
        demand: 0,
        rate: 0,
      });

      // Splitter -> New Target
      this.connections.push({
        id: crypto.randomUUID(),
        sourceBlockId: splitterId,
        targetBlockId: targetId,
        itemId,
        beltId: "conveyor-belt-mk-i",
        demand: 0,
        rate: 0,
      });

      console.log(
        `[GRAPH] Splitter injected at (${Math.round(splitX)}, ${Math.round(
          splitY
        )})`
      );
      return;
    }

    const connection: Connection = {
      id: crypto.randomUUID(),
      sourceBlockId: sourceId,
      targetBlockId: targetId,
      itemId,
      beltId: "conveyor-belt-mk-i", // Default to Mk.1
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
