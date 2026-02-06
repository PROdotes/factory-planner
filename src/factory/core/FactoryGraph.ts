/**
 * ROLE: Domain Model (Manager)
 * PURPOSE: Manages the factory layout, blocks, and connections.
 * RELATION: The single source of truth for the Factory State.
 */

import { BlockBase } from './BlockBase';
import { ProductionBlock } from '../blocks/ProductionBlock';
import { LogisticsBlock } from '../blocks/LogisticsBlock';
import { StorageBlock } from '../blocks/StorageBlock';
import { FactoryLayout, Connection, FactoryBlock } from './factory.types';

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



    addSink(name: string, x: number, y: number): StorageBlock {
        const id = crypto.randomUUID();
        const sink = new StorageBlock(id, name, x, y);
        this.blocks.set(id, sink);
        return sink;
    }

    addLogistics(subtype: 'splitter' | 'merger' | 'knot', x: number, y: number): LogisticsBlock {
        const id = crypto.randomUUID();
        const block = new LogisticsBlock(id, subtype, x, y);
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
        this.connections = this.connections.filter(c => c.sourceBlockId !== id && c.targetBlockId !== id);
    }

    /**
     * Connects two blocks with a directional flow of an item.
     */
    connect(sourceId: string, targetId: string, itemId: string) {
        if (!this.blocks.has(sourceId)) {
            console.error(`Connect Failed: Source Block '${sourceId}' does not exist.`);
            return;
        }
        if (!this.blocks.has(targetId)) {
            console.error(`Connect Failed: Target Block '${targetId}' does not exist.`);
            return;
        }

        const connection: Connection = {
            id: crypto.randomUUID(),
            sourceBlockId: sourceId,
            targetBlockId: targetId,
            itemId,
            demand: 0,
            rate: 0
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
            connections: [...this.connections]
        };
    }

    /**
     * Absorbs the calculated rates back into the Object Model.
     */
    syncFromDTO(dto: FactoryLayout) {
        // Sync Connections
        this.connections = dto.connections;

        // Sync Block Rates
        Object.values(dto.blocks).forEach(blockData => {
            const block = this.blocks.get(blockData.id);
            if (block) {
                block.syncState(blockData);
            }
        });
    }
}
