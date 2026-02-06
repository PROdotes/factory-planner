import { describe, it, expect } from 'vitest';
import { solveFlow } from '../flowSolver';
import { Block } from '@/types/block';
import { BeltConnection } from '@/types/connection';

describe('flowSolver', () => {
    it('should calculate flow immediately for unconnected input ports (0/x bug fix)', () => {
        const blocks: Block[] = [
            {
                id: 'b1',
                type: 'block',
                name: 'Producer',
                recipeId: 'r1',
                machineId: 'm1',
                calculationMode: 'output',
                targetRate: 60,
                targetMachineCount: undefined,
                machineCount: 1,
                actualRate: 60,
                speedModifier: 1.0,
                inputPorts: [],
                outputPorts: [{ id: 'out-1', type: 'output', itemId: 'item-1', rate: 60, side: 'right', offset: 0.5 }],
                efficiency: 1,
                size: { width: 400, height: 150 }
            },
            {
                id: 'b2',
                type: 'block',
                name: 'Consumer',
                recipeId: 'r2',
                machineId: 'm2',
                calculationMode: 'output',
                targetRate: 60,
                targetMachineCount: undefined,
                machineCount: 1,
                actualRate: 60,
                speedModifier: 1.0,
                inputPorts: [{ id: 'in-1', type: 'input', itemId: 'item-1', rate: 60, side: 'left', offset: 0.5 }],
                outputPorts: [],
                efficiency: 1,
                size: { width: 400, height: 150 }
            }
        ];

        const connections: BeltConnection[] = [
            {
                id: 'e1',
                from: { blockId: 'b1', portId: 'out-1' },
                to: { blockId: 'b2', portId: 'in-1' },
                beltTierId: 'belt-1',
                path: [],
                splits: [],
                utilization: 0,
                issues: []
            }
        ];

        const results = solveFlow(blocks, connections);
        expect(results.get('e1')).toBe(60);
    });

    it('should handle starvation when supply is less than demand', () => {
        const blocks: Block[] = [
            {
                id: 'b1',
                type: 'block',
                name: 'Half Producer',
                recipeId: 'r1',
                machineId: 'm1',
                calculationMode: 'output',
                targetRate: 30,
                targetMachineCount: undefined,
                machineCount: 1,
                actualRate: 30,
                speedModifier: 1.0,
                inputPorts: [],
                outputPorts: [{ id: 'out-1', type: 'output', itemId: 'item-1', rate: 30, side: 'right', offset: 0.5 }],
                efficiency: 1,
                size: { width: 400, height: 150 }
            },
            {
                id: 'b2',
                type: 'block',
                name: 'Full Consumer',
                recipeId: 'r2',
                machineId: 'm2',
                calculationMode: 'output',
                targetRate: 60,
                targetMachineCount: undefined,
                machineCount: 1,
                actualRate: 60,
                speedModifier: 1.0,
                inputPorts: [{ id: 'in-1', type: 'input', itemId: 'item-1', rate: 60, side: 'left', offset: 0.5 }],
                outputPorts: [{ id: 'out-2', type: 'output', itemId: 'item-2', rate: 60, side: 'right', offset: 0.5 }],
                efficiency: 1,
                size: { width: 400, height: 150 }
            }
        ];

        const connections: BeltConnection[] = [
            {
                id: 'e1',
                from: { blockId: 'b1', portId: 'out-1' },
                to: { blockId: 'b2', portId: 'in-1' },
                beltTierId: 'belt-1',
                path: [],
                splits: [],
                utilization: 0,
                issues: []
            }
        ];

        const results = solveFlow(blocks, connections);

        expect(results.get('e1')).toBe(30);
        expect(blocks.find(b => b.id === 'b2')?.efficiency).toBe(0.5);
    });
});
