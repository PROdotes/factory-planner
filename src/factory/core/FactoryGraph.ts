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
    // 1. Identify connections that will be removed
    const connectionsToRemove = this.connections.filter(
      (c) => c.sourceBlockId === id || c.targetBlockId === id
    );

    // 2. Explicitly remove each connection to trigger simplification logic
    connectionsToRemove.forEach((c) => {
      this.removeConnection(c.id);
    });

    // 3. Remove the block itself
    this.blocks.delete(id);
  }

  removeConnection(id: string) {
    const conn = this.connections.find((c) => c.id === id);
    if (!conn) return;

    const sourceId = conn.sourceBlockId;
    const targetId = conn.targetBlockId;

    // Remove the connection
    this.connections = this.connections.filter((c) => c.id !== id);

    // Check for simplification on both ends
    this.simplifyLogistics(sourceId);
    this.simplifyLogistics(targetId);
  }

  /**
   * Checks if a logistics block is redundant (1 input, 1 output) and removes it, bridging the gap.
   */
  private simplifyLogistics(blockId: string) {
    const block = this.blocks.get(blockId);
    if (!block || block.type !== "logistics") return;

    // Find all connections touching this block
    const inputs = this.connections.filter((c) => c.targetBlockId === blockId);
    const outputs = this.connections.filter((c) => c.sourceBlockId === blockId);

    // Case 1: Redundant Pass-through (1 IN, 1 OUT)
    if (inputs.length === 1 && outputs.length === 1) {
      console.log(`[GRAPH] Simplifying redundant splitter: ${blockId}`);
      const inputConn = inputs[0];
      const outputConn = outputs[0];

      // SURGICAL REMOVAL: Do not trigger recursive checks
      this._deleteBlockSurgical(blockId);

      // Bridge the gap: Input Source -> Output Target
      this._connectSurgical(
        inputConn.sourceBlockId,
        outputConn.targetBlockId,
        inputConn.itemId
      );

      // Update the new connection's belt ID
      const newConn = this.connections.find(
        (c) =>
          c.sourceBlockId === inputConn.sourceBlockId &&
          c.targetBlockId === outputConn.targetBlockId
      );
      if (newConn && inputConn.beltId) {
        newConn.beltId = inputConn.beltId;
      }

      return;
    }

    // Case 2: Orphaned Logistics (0 IN, 0 OUT)
    if (inputs.length === 0 && outputs.length === 0) {
      console.log(`[GRAPH] Removing orphaned splitter: ${blockId}`);
      this._deleteBlockSurgical(blockId);
      return;
    }
  }

  /**
   * Internal helper: Removes a block and its connections purely from data.
   * Does NOT trigger neighbors or simplification logic.
   */
  private _deleteBlockSurgical(blockId: string) {
    this.blocks.delete(blockId);
    this.connections = this.connections.filter(
      (c) => c.sourceBlockId !== blockId && c.targetBlockId !== blockId
    );
  }

  /**
   * Internal helper: Adds a connection directly without triggering auto-splitter logic.
   */
  private _connectSurgical(sourceId: string, targetId: string, itemId: string) {
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
    return connection;
  }

  /**
   * Connects two blocks with a directional flow of an item.
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

    const sourceBlock = this.blocks.get(sourceId)!;
    const targetBlock = this.blocks.get(targetId)!;

    // --- [MANIFOLD PROPAGATION / AUTO-SPLITTER] ---
    // Rule: We want to build a linear manifold (Chain) rather than a star.
    // Logic: If Source is already BUSY with this Item, follow the line to the end or tip.
    const existingOutputs = this.connections.filter(
      (c) => c.sourceBlockId === sourceId && c.itemId === itemId
    );

    if (existingOutputs.length > 0) {
      // 1. Prioritize following an existing Logistics path (Continuing the chain)
      const continuation = existingOutputs.find(
        (c) => this.blocks.get(c.targetBlockId)?.type === "logistics"
      );

      if (continuation) {
        console.log(
          `[GRAPH] Forwarding connection down the chain: ${sourceId} -> ${continuation.targetBlockId}`
        );
        this.connect(continuation.targetBlockId, targetId, itemId);
        return;
      }

      // 2. If no logistics continuation, but we are a Machine (not a junction)
      // or a Junction that wants to start a new chain, we SPLIT the first machine line.
      if (sourceBlock.type !== "logistics" || existingOutputs.length >= 1) {
        // Identify the segment to split.
        // If we have multiple machine outputs, pick the one closest to the target.
        let segmentToSplit = existingOutputs[0];
        if (existingOutputs.length > 1) {
          segmentToSplit = existingOutputs.reduce((prev, curr) => {
            const bPrev = this.blocks.get(prev.targetBlockId)!;
            const bCurr = this.blocks.get(curr.targetBlockId)!;
            const dPrev =
              (bPrev.position.x - targetBlock.position.x) ** 2 +
              (bPrev.position.y - targetBlock.position.y) ** 2;
            const dCurr =
              (bCurr.position.x - targetBlock.position.x) ** 2 +
              (bCurr.position.y - targetBlock.position.y) ** 2;
            return dCurr < dPrev ? curr : prev;
          });
        }

        const downstreamId = segmentToSplit.targetBlockId;
        const downstreamBlock = this.blocks.get(downstreamId);
        if (!downstreamBlock) return;

        console.log(
          `[GRAPH] Splitting terminal segment: ${sourceId} -> ${downstreamId}`
        );

        // Calculate Midpoint
        const splitX =
          (sourceBlock.position.x + downstreamBlock.position.x) / 2;
        const splitY =
          (sourceBlock.position.y + downstreamBlock.position.y) / 2;

        // Create Splitter
        const splitter = this.addLogistics(splitX, splitY);

        // Remove old connection
        this.connections = this.connections.filter(
          (c) => c.id !== segmentToSplit.id
        );

        // Wire Source -> Splitter
        this.connections.push({
          id: crypto.randomUUID(),
          sourceBlockId: sourceId,
          targetBlockId: splitter.id,
          itemId,
          beltId: segmentToSplit.beltId || "conveyor-belt-mk-i",
          demand: 0,
          rate: 0,
        });

        // Wire Splitter -> Original Target
        this.connections.push({
          id: crypto.randomUUID(),
          sourceBlockId: splitter.id,
          targetBlockId: downstreamId,
          itemId,
          beltId: segmentToSplit.beltId || "conveyor-belt-mk-i",
          demand: 0,
          rate: 0,
        });

        // Wire Splitter -> New Target
        this.connections.push({
          id: crypto.randomUUID(),
          sourceBlockId: splitter.id,
          targetBlockId: targetId,
          itemId,
          beltId: "conveyor-belt-mk-i",
          demand: 0,
          rate: 0,
        });

        return;
      }
    }

    // Default Connection
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
