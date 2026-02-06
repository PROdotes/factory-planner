/**
 * ROLE: Solver Utility
 * PURPOSE: Aggregates production and consumption rates across the entire factory.
 * RELATION: Used by BalanceTable in the Analytics Sidebar.
 */

import { FactoryLayout } from "../factory/core/factory.types";

export interface ItemBalance {
  itemId: string;
  produced: number;
  consumed: number;
  net: number;
}

export function computeGlobalBalance(
  layout: FactoryLayout
): Record<string, ItemBalance> {
  const balances: Record<string, ItemBalance> = {};

  const getBalance = (itemId: string) => {
    if (!balances[itemId]) {
      balances[itemId] = { itemId, produced: 0, consumed: 0, net: 0 };
    }
    return balances[itemId];
  };

  // 1. Aggregate from blocks
  Object.values(layout.blocks).forEach((block) => {
    // Logistics blocks (Splitters/Mergers) are pass-through;
    // they don't count as primary producers or consumers in global totals.
    if (block.type === "logistics") return;

    const flows = block.results?.flows || {};

    Object.keys(flows).forEach((itemId) => {
      const res = flows[itemId];

      // Determine if this block is a primary producer or consumer of this item.
      // A producer has this item in its 'output' or 'requested' targets.
      const isProducer =
        (block.output && block.output[itemId] !== undefined) ||
        (block.requested && block.requested[itemId] !== undefined);

      if (isProducer) {
        // Capacity is the theoretical max this item can be produced by this block (ABC Pillar).
        getBalance(itemId).produced += res.capacity;
      } else {
        // CONSUMER: Use the raw block.demand to reflect the full engineering requirement,
        // even if the machine is currently starving (delivered < demand).
        getBalance(itemId).consumed += block.demand[itemId] || 0;
      }
    });
  });

  // 2. Finalize net
  Object.values(balances).forEach((b) => {
    b.net = b.produced - b.consumed;
  });

  return balances;
}
