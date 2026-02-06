import { Block } from '@/types/block';
import { GameDefinition } from '@/types/game';
import { solveBlock } from '@/lib/solver/rateSolver';
import { calculateBlockDimensions } from '@/lib/layout/manifoldSolver';

export const applyBlockSolver = (block: Block, game: GameDefinition) => {
    const recipe = game.recipes.find((candidate) => candidate.id === block.recipeId);
    const machine = game.machines.find((candidate) => candidate.id === block.machineId) || game.machines[0];

    if (!recipe || !machine) {
        return;
    }

    let speedMult = block.speedModifier || 1.0;
    let prodBonus = 0.0;

    if (block.modifier) {
        if (block.modifier.type === 'speed') {
            if (block.modifier.level === 1) speedMult *= 1.25;
            if (block.modifier.level === 2) speedMult *= 1.50;
            if (block.modifier.level === 3) speedMult *= 2.00;
        } else if (block.modifier.type === 'productivity') {
            if (block.modifier.level === 1) prodBonus = 0.125;
            if (block.modifier.level === 2) prodBonus = 0.20;
            if (block.modifier.level === 3) prodBonus = 0.25;
        }
    }

    const solved = solveBlock(
        recipe,
        machine,
        block.targetRate,
        speedMult,
        block.primaryOutputId,
        prodBonus,
        block.calculationMode === 'machines' ? (block.targetMachineCount ?? block.machineCount) : undefined,
        game.settings.rateUnit
    );

    block.machineCount = Math.max(0.1, solved.machineCount);
    if (isNaN(block.machineCount)) block.machineCount = 1;
    block.actualRate = solved.actualRate;

    // 4. Synchronize Ports
    const syncPorts = (existing: any[], targetDefs: any[], type: 'input' | 'output') => {
        // Keep existing ports if they match an item in the definition
        const newPorts = targetDefs.map((def, idx) => {
            const existingPort = existing.find(p => p.itemId === def.itemId);
            const rate = (type === 'input' ? solved.inputRates : solved.outputRates)
                .find((r: { itemId: string; rate: number }) => r.itemId === def.itemId)?.rate || 0;

            return {
                id: existingPort?.id || `${type}-${def.itemId}`,
                type,
                itemId: def.itemId,
                rate,
                side: existingPort?.side || (type === 'input' ? 'left' : 'right'),
                offset: existingPort?.offset || (idx + 1) / (targetDefs.length + 1)
            };
        });
        return newPorts;
    };

    block.inputPorts = syncPorts(block.inputPorts, recipe.inputs, 'input');
    block.outputPorts = syncPorts(block.outputPorts, recipe.outputs, 'output');

    const { size } = calculateBlockDimensions(block.inputPorts.length, block.outputPorts.length);
    block.size = size;
};
