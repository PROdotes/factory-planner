/**
 * ROLE: Solver Utility
 * PURPOSE: Aggregates production and consumption rates across the entire factory.
 * RELATION: Used by BalanceTable in the Analytics Sidebar.
 */

import { FactoryLayout } from '../factory/core/factory.types';

export interface ItemBalance {
    itemId: string;
    produced: number;
    consumed: number;
    net: number;
}

export function computeGlobalBalance(layout: FactoryLayout): Record<string, ItemBalance> {
    const balances: Record<string, ItemBalance> = {};

    const getBalance = (itemId: string) => {
        if (!balances[itemId]) {
            balances[itemId] = { itemId, produced: 0, consumed: 0, net: 0 };
        }
        return balances[itemId];
    };

    // 1. Aggregate from blocks
    Object.values(layout.blocks).forEach(block => {
        // Production: What this block adds to the global pool
        Object.entries(block.output || {}).forEach(([itemId, rate]) => {
            getBalance(itemId).produced += rate as number;
        });

        // Consumption: What this block removes from the global pool
        Object.entries(block.requested || {}).forEach(([itemId, rate]) => {
            getBalance(itemId).consumed += rate as number;
        });
    });

    // 2. Finalize net
    Object.values(balances).forEach(b => {
        // Net can be slightly negative due to floating point or starvation
        // In a perfectly balanced factory, Net is 0.
        // Surplus is positive.
        b.net = b.produced - b.consumed;
    });

    return balances;
}
