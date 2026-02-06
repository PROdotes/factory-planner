import { Block } from '@/types/block';
import { GameDefinition } from '@/types/game';
import { solveBlock } from './rateSolver';

export function applyBlockSolver(block: Block, game: GameDefinition) {
    if (!block.recipeId) return;
    const recipe = game.recipes.find(r => r.id === block.recipeId);
    if (!recipe) return;
    const machine = game.machines.find(m => m.id === block.machineId);
    if (!machine) return;

    let targetRate = 0;
    let targetMachineCount: number | undefined = undefined;

    if (block.calculationMode === 'machines') {
        targetMachineCount = block.targetMachineCount ?? block.machineCount;
    } else {
        targetRate = block.targetRate;
    }

    // 3. Solve!
    const result = solveBlock(
        recipe,
        machine,
        targetRate,
        block.speedModifier,
        block.primaryOutputId,
        0, // productivity
        targetMachineCount,
        game.settings.rateUnit // 'minute'
    );

    // 4. THE PERMANENT FIX: Interlink the targets based on Calculation Mode.
    // If the user defines the MACHINES, we update the RATE to match the potential.
    // If the user defines the RATE, we update the MACHINES to match the requirement.
    if (block.calculationMode === 'machines') {
        block.targetRate = result.actualRate;
    } else {
        block.targetMachineCount = result.machineCount;
    }

    // 5. Apply results to block visual state
    block.machineCount = result.machineCount;
    block.actualRate = result.actualRate;

    // 6. Update ports
    block.inputPorts.forEach(port => {
        const r = result.inputRates.find(ir => ir.itemId === port.itemId);
        if (r) port.rate = r.rate;
    });

    block.outputPorts.forEach(port => {
        const r = result.outputRates.find(or => or.itemId === port.itemId);
        if (r) port.rate = r.rate;
    });
}
