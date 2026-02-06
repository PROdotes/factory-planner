/**
 * ROLE: UI Component (Analytics)
 * PURPOSE: Shows blocks with production shortfalls and allows quick navigation.
 * RELATION: Rendered in RightSidebar.
 */

import { useFactoryStore } from '../../factory/factoryStore';
import { useGameDataStore } from '../../gamedata/gamedataStore';
import { useUIStore } from '../uiStore';
import { AlertCircle } from 'lucide-react';
import { FLOW_CONFIG, getBlockHeight } from '../../canvas/LayoutConfig';

export function BottleneckAlerts() {
    const { factory, selectBlock } = useFactoryStore();
    const { items } = useGameDataStore();
    const { toggleFocus } = useUIStore();

    const bottlenecks = Array.from(factory.blocks.values())
        .filter(b => b.satisfaction < 0.999)
        .sort((a, b) => a.satisfaction - b.satisfaction);

    if (bottlenecks.length === 0) {
        return <p className="mono-text" style={{ opacity: 0.3, padding: '0 4px' }}>All systems nominal</p>;
    }

    return (
        <div className="bottleneck-alerts">
            {bottlenecks.slice(0, 5).map(block => {
                // Find most starved item (highest demand-supply gap)
                const starvedItems = Object.entries(block.demand)
                    .map(([itemId, goal]) => ({
                        itemId,
                        gap: goal - (block.supply[itemId] || 0)
                    }))
                    .sort((a, b) => b.gap - a.gap);

                const mainStarved = starvedItems[0];

                return (
                    <div
                        key={block.id}
                        className="bottleneck-card"
                        onClick={() => {
                            // 1. [Navigation & Selection]
                            selectBlock(block.id);
                            toggleFocus(block.id); // Also trigger Deep Focus for debugging

                            const inputPorts = Object.keys(block.demand || {}).length;
                            const outputPorts = Object.keys(block.output || {}).length;
                            const cardHeight = getBlockHeight(inputPorts, outputPorts);

                            // 2. [Camera Pan]
                            window.dispatchEvent(new CustomEvent('canvas-pan-to', {
                                detail: {
                                    x: block.position.x + FLOW_CONFIG.BLOCK_WIDTH / 2,
                                    y: block.position.y + cardHeight / 2
                                }
                            }));
                        }}
                    >
                        <AlertCircle size={14} className="icon" />
                        <div className="info">
                            <span className="node-name">{block.name}</span>
                            <span className="starved-info">
                                Starved of {items[mainStarved?.itemId]?.name || 'Resources'}
                            </span>
                        </div>
                        <span className="pct">{(block.satisfaction * 100).toFixed(0)}%</span>
                    </div>
                );
            })}
        </div>
    );
}
