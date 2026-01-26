import { describe, it, expect } from 'vitest';
import { solveBlock } from '../rateSolver';
import { Recipe, Machine } from '@/types/game';

// Mocks
// Mocks
const MOCK_RECIPE: Recipe = {
    id: 'iron-ingot',
    name: 'Iron Ingot',
    category: 'smelting',
    craftingTime: 1, // 1 second
    inputs: [{ itemId: 'iron-ore', amount: 1 }],
    outputs: [{ itemId: 'iron-ingot', amount: 1 }],
    machineId: 'arc-smelter'
};

const MOCK_MACHINE: Machine = {
    id: 'arc-smelter',
    name: 'Arc Smelter',
    category: 'smelter',
    speed: 1.0,
    size: { width: 1, height: 1 },
    powerUsage: 360,
    allowedCategories: ['smelting']
};

const MOCK_MACHINE_MK2: Machine = {
    ...MOCK_MACHINE,
    id: 'plane-smelter',
    name: 'Plane Smelter',
    speed: 2.0
};

describe('rateSolver', () => {
    it('calculates machine count regarding target rate', () => {
        // Recipe: 1 item / 1 sec = 60 items/min base.
        // Machine Speed: 1.0.
        // Target: 60.
        // Expected: 1 machine.
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 60);
        expect(result.machineCount).toBeCloseTo(1.0);
        expect(result.actualRate).toBeCloseTo(60);
    });

    it('scales machine count linearly with target rate', () => {
        // Target: 120. Expected: 2 machines.
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 120);
        expect(result.machineCount).toBeCloseTo(2.0);
        expect(result.actualRate).toBeCloseTo(120);
    });

    it('accounts for machine speed', () => {
        // Machine Speed: 2.0. Base Recipe: 60/min.
        // 1 Machine = 120/min.
        // Target: 120.
        // Expected: 1 machine.
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE_MK2, 120);
        expect(result.machineCount).toBeCloseTo(1.0);
    });

    it('accounts for speed modifier (e.g. proliferation)', () => {
        // Speed Mod: 2.0.
        // 1 Machine (1.0) * SpeedMod (2.0) = 120/min.
        // Target: 120.
        // Expected: 1 machine.
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 120, 2.0);
        expect(result.machineCount).toBeCloseTo(1.0);
    });

    it('calculates input requirements correclty', () => {
        // Target 60 output/min -> Need 60 input/min (1:1 ratio)
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 60);
        expect(result.inputRates[0].rate).toBeCloseTo(60);
    });

    it('handles targetRate 0', () => {
        // Should default to 1 machine worth of production but 0 target? 
        // Logic says: if targetRate is 0, return { machineCount: 1, ... } based on code reading.
        const result = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 0);
        expect(result.machineCount).toBe(1);
        expect(result.actualRate).toBe(60); // 1 machine at 1.0 speed
    });

    it('handles fractional inputs', () => {
        // Recipe: 2 Ore -> 1 Ingot in 1s.
        const EXPENSIVE_RECIPE: Recipe = {
            ...MOCK_RECIPE,
            inputs: [{ itemId: 'iron-ore', amount: 2 }]
        };
        // Target 60 Ingots/min.
        // Machine needs 2 * 60 = 120 Ore/min.
        const result = solveBlock(EXPENSIVE_RECIPE, MOCK_MACHINE, 60);
        expect(result.inputRates[0].rate).toBeCloseTo(120);
    });
    describe('Bidirectional Logic', () => {
        it('calculates consistent values when switching modes', () => {
            // mode: Output Driven
            // Target 120. Base 60. => 2 machines.
            const outputDriven = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 120);
            expect(outputDriven.machineCount).toBeCloseTo(2.0);
            expect(outputDriven.actualRate).toBeCloseTo(120);

            // mode: Machine Driven
            // Machines 2. Base 60. => 120 output.
            const machineDriven = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 0, 1.0, undefined, 0.0, 2);
            expect(machineDriven.machineCount).toBe(2);
            expect(machineDriven.actualRate).toBeCloseTo(120);

            // Fractional Machines
            // Machines 2.5 -> 150
            const fractionalPos = solveBlock(MOCK_RECIPE, MOCK_MACHINE, 0, 1.0, undefined, 0.0, 2.5);
            expect(fractionalPos.machineCount).toBe(2.5);
            expect(fractionalPos.actualRate).toBeCloseTo(150);
        });
    });
});
