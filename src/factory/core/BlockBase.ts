/**
 * ROLE: Domain Model (Base Class)
 * PURPOSE: Abstract representation of any block in the factory.
 * RELATION: Parent of all specific block types (Production, Resource, Storage, Logistics).
 */

import { FactoryBlock } from './factory.types';

export abstract class BlockBase {
    id: string;
    type: FactoryBlock['type'];
    name: string = "";
    position: { x: number, y: number };

    // State
    demand: Record<string, number> = {};
    supply: Record<string, number> = {};
    output: Record<string, number> = {};
    requested: Record<string, number> = {};
    satisfaction: number = 1.0;
    sourceYield: number = 6.0; // Default to 6 for miners compatibility

    results: {
        flows: Record<string, { actual: number, demand: number, capacity: number }>;
        satisfaction: number;
    } = { flows: {}, satisfaction: 1.0 };

    constructor(id: string, type: FactoryBlock['type'], x: number, y: number, name: string) {
        this.id = id;
        this.type = type;
        this.position = { x, y };
        this.name = name;
    }

    /**
     * Serializes the object back to the pure format for the Solver.
     */
    abstract toDTO(): FactoryBlock;

    /**
     * Updates the local state from a solved snapshot.
     */
    syncState(data: FactoryBlock) {
        this.demand = { ...data.demand };
        this.supply = { ...data.supply };
        this.output = { ...data.output };
        this.requested = { ...data.requested || {} };
        this.satisfaction = data.satisfaction;
        this.sourceYield = data.sourceYield ?? (this.type === 'block' ? 6.0 : 1.0);

        if (data.results) {
            this.results = {
                flows: { ...data.results.flows },
                satisfaction: data.results.satisfaction
            };
        }
    }
}
