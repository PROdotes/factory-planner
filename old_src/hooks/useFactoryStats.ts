import { useMemo } from 'react';
import { Edge } from 'reactflow';
import { Block, BlockNode } from '@/types/block';
import { Machine } from '@/types/game';

interface FactoryStatsResult {
    totalPower: number;
    conflictCount: number;
    machineCount: number;
    isReady: boolean;
    formatPower: (watts: number) => string;
}

export const useFactoryStats = (
    nodes: BlockNode[],
    edges: Edge[],
    machines: Machine[]
): FactoryStatsResult => {
    const stats = useMemo(() => {
        let totalPower = 0;
        let machineCount = 0;

        nodes.forEach((node) => {
            if (node.type === 'block') {
                const data = node.data as Block;
                const machine = machines.find((candidate) => candidate.id === data.machineId);
                if (machine) {
                    totalPower += data.machineCount * (machine.powerUsage || 0);
                    machineCount += Math.ceil(data.machineCount);
                }
            }
        });

        const conflictCount = edges.filter((edge) => edge.data?.status && edge.data.status !== 'ok').length;

        return {
            totalPower,
            conflictCount,
            machineCount,
            isReady: nodes.length > 0 && conflictCount === 0
        };
    }, [nodes, edges, machines]);

    const formatPower = (watts: number) => {
        if (watts >= 1000000) return `${(watts / 1000000).toFixed(2)} MW`;
        if (watts >= 1000) return `${(watts / 1000).toFixed(0)} kW`;
        return `${watts.toFixed(0)} W`;
    };

    return { ...stats, formatPower };
};
