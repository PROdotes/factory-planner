import { useMemo } from 'react';
import { Edge } from 'reactflow';
import { Block, EdgeStatus } from '@/types/block';
import { Machine } from '@/types/game';

interface BlockMetricsResult {
    totalPowerWatts: number;
    hasConflict: boolean;
    portStates: Record<string, { status: EdgeStatus; connected: boolean }>;
    getItemName: (id: string) => string;
    formatPower: (watts: number) => string;
}

export const useBlockMetrics = (
    blockId: string,
    data: Block,
    edges: Edge[],
    machines: Machine[],
    items: { id: string; name: string }[]
): BlockMetricsResult => {
    const { totalPowerWatts, hasConflict, portStates } = useMemo(() => {
        const connectedEdges = edges.filter((edge) => edge.source === blockId || edge.target === blockId);
        const conflict = connectedEdges.some((edge) => (
            edge.data?.status === 'bottleneck' || edge.data?.status === 'overload' || edge.data?.status === 'underload'
        ));

        const keyMap: Record<string, { status: EdgeStatus; connected: boolean }> = {};
        connectedEdges.forEach((edge) => {
            const status = edge.data?.status || 'ok';
            if (edge.source === blockId && edge.sourceHandle) {
                keyMap[edge.sourceHandle] = { status, connected: true };
            }
            if (edge.target === blockId && edge.targetHandle) {
                keyMap[edge.targetHandle] = { status, connected: true };
            }
        });

        const machine = machines.find((candidate) => candidate.id === data.machineId);
        const power = data.machineCount * (machine?.powerUsage || 0);

        return { totalPowerWatts: power, hasConflict: conflict, portStates: keyMap };
    }, [blockId, data.machineId, data.machineCount, edges, machines]);

    const formatPower = (watts: number) => {
        if (watts >= 1000000) return `${(watts / 1000000).toFixed(2)} MW`;
        if (watts >= 1000) return `${(watts / 1000).toFixed(0)} kW`;
        return `${watts.toFixed(0)} W`;
    };

    const getItemName = (id: string) => {
        return items.find((item) => item.id === id)?.name || id;
    };

    return { totalPowerWatts, hasConflict, portStates, getItemName, formatPower };
};
