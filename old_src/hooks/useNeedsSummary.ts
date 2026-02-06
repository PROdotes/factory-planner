import { useMemo } from 'react';
import { Edge } from 'reactflow';
import { Block, BlockNode, BeltEdgeData } from '@/types/block';
import { formatRate as formatRateValue } from '@/lib/rates';
import { GameSettings, Item, Machine } from '@/types/game';

interface NeedsSummaryResult {
    inputSummary: { itemId: string; name: string; rate: number }[];
    netOutputs: { itemId: string; name: string; rate: number }[];
    buildingBom: { id: string; name: string; count: number }[];
    formatRate: (rate: number) => string;
}

export const useNeedsSummary = (
    nodes: BlockNode[],
    edges: Edge[],
    items: Item[],
    machines: Machine[],
    showTotalInputs: boolean,
    rateUnit: GameSettings['rateUnit']
): NeedsSummaryResult => {
    const inputSummary = useMemo(() => {
        const summary = new Map<string, number>();

        nodes.forEach((node) => {
            node.data.inputPorts.forEach((port) => {
                let value;
                if (showTotalInputs) {
                    value = port.rate;
                } else {
                    const incoming = edges
                        .filter((edge) => edge.target === node.id && edge.targetHandle === port.id)
                        .reduce((total, edge) => {
                            const flow = (edge.data as BeltEdgeData | undefined)?.flowRate ?? 0;
                            return total + flow;
                        }, 0);
                    value = Math.max(0, port.rate - incoming);
                }

                if (value > 0.01) {
                    summary.set(port.itemId, (summary.get(port.itemId) || 0) + value);
                }
            });
        });

        return Array.from(summary.entries())
            .map(([itemId, rate]) => ({
                itemId,
                name: items.find((item) => item.id === itemId)?.name || itemId,
                rate
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [nodes, edges, items, showTotalInputs]);

    const netOutputs = useMemo(() => {
        const outputs = new Map<string, number>();

        nodes.forEach((node) => {
            node.data.outputPorts.forEach((port) => {
                const outgoing = edges
                    .filter((edge) => edge.source === node.id && edge.sourceHandle === port.id)
                    .reduce((total, edge) => {
                        const flow = (edge.data as BeltEdgeData | undefined)?.flowRate ?? 0;
                        return total + flow;
                    }, 0);

                const excess = Math.max(0, port.rate - outgoing);
                if (excess > 0.01) {
                    outputs.set(port.itemId, (outputs.get(port.itemId) || 0) + excess);
                }
            });
        });

        return Array.from(outputs.entries())
            .map(([itemId, rate]) => ({
                itemId,
                name: items.find((item) => item.id === itemId)?.name || itemId,
                rate
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [nodes, edges, items]);

    const buildingBom = useMemo(() => {
        const counts = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.type === 'block') {
                const data = node.data as Block;
                counts.set(data.machineId, (counts.get(data.machineId) || 0) + data.machineCount);
            }
        });

        return Array.from(counts.entries()).map(([machineId, count]) => ({
            id: machineId,
            name: machines.find((machine) => machine.id === machineId)?.name || machineId,
            count: Math.ceil(count)
        })).sort((a, b) => b.count - a.count);
    }, [nodes, machines]);

    const formatRate = (rate: number) => formatRateValue(rate, rateUnit);

    return { inputSummary, netOutputs, buildingBom, formatRate };
};
