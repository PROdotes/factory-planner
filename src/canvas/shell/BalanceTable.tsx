/**
 * ROLE: UI Component (Analytics)
 * PURPOSE: Renders a sortable table of global production/consumption balances.
 * RELATION: Rendered in RightSidebar.
 */

import { useMemo, useState } from 'react';
import { useFactoryStore } from '../../factory/factoryStore';
import { useGameDataStore } from '../../gamedata/gamedataStore';
import { computeGlobalBalance, ItemBalance } from '../../solver/computeBalance';
import { ItemIcon } from '../blocks/ItemIcon';
import { FactoryLayout } from '../../factory/core/factory.types';
import { useUIStore } from '../uiStore';
import { useHighlightSet } from '../hooks/useHighlightSet';

export function BalanceTable() {
    const { factory, version } = useFactoryStore();
    const { items } = useGameDataStore();
    const { rateUnit } = useUIStore();
    const highlightSet = useHighlightSet();
    const [sortKey, setSortKey] = useState<keyof ItemBalance>('net');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const isPerMin = rateUnit === 'per_minute';
    const mult = isPerMin ? 60 : 1;
    const unitLabel = isPerMin ? '/m' : '/s';

    const balances = useMemo(() => {
        // Index blocks by ID for FactoryLayout structure
        const blocksRecord: Record<string, any> = {};
        factory.blocks.forEach(b => {
            blocksRecord[b.id] = b.toDTO();
        });

        const layout: FactoryLayout = {
            blocks: blocksRecord,
            connections: factory.connections
        };

        const raw = computeGlobalBalance(layout);
        return Object.values(raw).filter(b => b.produced > 0 || b.consumed > 0);
    }, [factory, version]);

    const sortedBalances = useMemo(() => {
        return [...balances].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            const numA = valA as number;
            const numB = valB as number;
            return sortDir === 'asc' ? numA - numB : numB - numA;
        });
    }, [balances, sortKey, sortDir]);

    const handleSort = (key: keyof ItemBalance) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    if (balances.length === 0) {
        return <p className="mono-text" style={{ padding: '0 4px' }}>No active flow data</p>;
    }

    return (
        <div className="balance-table-container">
            <table className="balance-table">
                <thead>
                    <tr>
                        <th onClick={() => handleSort('itemId')}>Item</th>
                        <th onClick={() => handleSort('produced')}>Prod{unitLabel}</th>
                        <th onClick={() => handleSort('consumed')}>Cons{unitLabel}</th>
                        <th onClick={() => handleSort('net')} className={sortKey === 'net' ? 'sort-active' : ''}>Net{unitLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedBalances.map(block => {
                        const isHighlighted = highlightSet.outputItems.has(block.itemId);
                        return (
                            <tr key={block.itemId} className={isHighlighted ? 'highlighted' : ''}>
                                <td>
                                    <div className="item-cell">
                                        <ItemIcon itemId={block.itemId} size={18} />
                                        <span>{items[block.itemId]?.name || block.itemId}</span>
                                    </div>
                                </td>
                                <td>{(block.produced * mult).toFixed(1)}</td>
                                <td>{(block.consumed * mult).toFixed(1)}</td>
                                <td className={block.net > 0.1 ? 'net-surplus' : (block.net < -0.1 ? 'net-deficit' : 'net-balanced')}>
                                    {block.net > 0 ? '+' : ''}{(block.net * mult).toFixed(1)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
