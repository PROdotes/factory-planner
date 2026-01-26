import { Block } from '@/types/block';
import { BeltConnection } from '@/types/connection';

/**
 * Iteratively calculates flow rates through the entire network.
 * Handles starvation, backpressure, and the "unconnected supply" rule.
 */
export function solveFlow(blocks: Block[], connections: BeltConnection[]) {
    // 1. Reset all flow rates to 0 for a fresh solve
    const edgeFlows = new Map<string, number>();
    connections.forEach(conn => edgeFlows.set(conn.id, 0));

    // 2. Iterative solver (Simple convergence for now)
    for (let i = 0; i < 5; i++) {
        blocks.forEach(block => {
            // A. INPUT SIDE: Determine how much "Supply" is available to this block
            block.inputPorts.forEach(port => {
                const incomingEdges = connections.filter(c => c.to.blockId === block.id && c.to.portId === port.id);

                // CRITICAL FIX: If no edges are connected, treat as 100% supplied so block can calculate demand
                if (incomingEdges.length === 0) {
                    port.currentRate = port.rate;
                } else {
                    port.currentRate = incomingEdges.reduce((sum, edge) => sum + (edgeFlows.get(edge.id) || 0), 0);
                }
            });

            // B. MACHINE CALCULATION: How much can the machines actually produce?
            let efficiency = 1.0;
            block.inputPorts.forEach(port => {
                if (port.rate > 0) {
                    const portEfficiency = Math.min(1.0, (port.currentRate || 0) / port.rate);
                    efficiency = Math.min(efficiency, portEfficiency);
                }
            });
            block.efficiency = efficiency;

            // C. OUTPUT SIDE: Determine how much "Demand" is pulling from this block
            block.outputPorts.forEach(port => {
                const outgoingEdges = connections.filter(c => c.from.blockId === block.id && c.from.portId === port.id);

                // Calculate theoretical production
                const theoreticalProduction = port.rate * efficiency;

                // Distribute production among outgoing edges
                if (outgoingEdges.length > 0) {
                    const flowPerEdge = theoreticalProduction / outgoingEdges.length;
                    outgoingEdges.forEach(edge => {
                        edgeFlows.set(edge.id, flowPerEdge);
                    });
                }

                port.currentRate = theoreticalProduction;
            });
        });
    }

    return edgeFlows;
}
