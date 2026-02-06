/**
 * ROLE: Domain Model (Storage Block / Sink)
 * PURPOSE: Represents a terminal consumer or storage container.
 */

import { BlockBase } from '../core/BlockBase';
import { StorageBlock as StorageDTO } from '../core/factory.types';

export class StorageBlock extends BlockBase {
    constructor(id: string, name: string, x: number, y: number) {
        super(id, 'sink', x, y, name);
    }

    setRequest(itemId: string, rate: number) {
        this.demand[itemId] = rate;
    }

    toDTO(): StorageDTO {
        return {
            id: this.id,
            type: 'sink',
            name: this.name,
            demand: { ...this.demand },
            supply: { ...this.supply },
            output: { ...this.output },
            satisfaction: this.satisfaction,
            results: {
                flows: { ...this.results.flows },
                satisfaction: this.results.satisfaction
            }
        };
    }
}
