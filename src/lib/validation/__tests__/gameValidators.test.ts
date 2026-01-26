import { describe, it, expect } from 'vitest';
import { checkGameDataConsistency } from '../gameValidators';
import { GameDefinition } from '@/types/game';

const MINIMAL_VALID_GAME: GameDefinition = {
    id: 'test',
    name: 'Test',
    version: '1',
    settings: {
        lanesPerBelt: 1,
        hasSpeedModifiers: false,
        rateUnit: 'minute',
        gridSize: 1
    },
    items: [
        { id: 'item1', name: 'Item 1', category: 'raw', stackSize: 100 },
        { id: 'item2', name: 'Item 2', category: 'raw', stackSize: 100 }
    ],
    machines: [
        { id: 'machine1', name: 'Machine 1', category: 'smelter', speed: 1.0, size: { width: 1, height: 1 } }
    ],
    recipes: [
        {
            id: 'recipe1',
            name: 'Recipe 1',
            machineId: 'machine1',
            inputs: [{ itemId: 'item1', amount: 1 }],
            outputs: [{ itemId: 'item2', amount: 1 }],
            craftingTime: 1,
            category: 'smelting'
        }
    ],
    belts: [
        { id: 'belt1', name: 'Belt 1', tier: 1, itemsPerSecond: 6, color: '#000' }
    ]
};

describe('checkGameDataConsistency', () => {
    it('returns no issues for valid data', () => {
        const issues = checkGameDataConsistency(MINIMAL_VALID_GAME);
        expect(issues).toHaveLength(0);
    });

    it('flags unknown machine references', () => {
        const badData = {
            ...MINIMAL_VALID_GAME,
            recipes: [
                {
                    ...MINIMAL_VALID_GAME.recipes[0],
                    machineId: 'missing-machine',
                },
            ],
        };

        const issues = checkGameDataConsistency(badData);
        expect(issues.some(issue => issue.message.includes('missing-machine'))).toBe(true);
    });

    it('flags unknown item references', () => {
        const badData = {
            ...MINIMAL_VALID_GAME,
            recipes: [
                {
                    ...MINIMAL_VALID_GAME.recipes[0],
                    inputs: [{ itemId: 'missing-item', amount: 1 }],
                },
            ],
        };

        const issues = checkGameDataConsistency(badData);
        expect(issues.some(issue => issue.message.includes('missing-item'))).toBe(true);
    });

    it('warns about self-looping recipes', () => {
        const recipe = MINIMAL_VALID_GAME.recipes[0];
        const loopData = {
            ...MINIMAL_VALID_GAME,
            recipes: [
                {
                    ...recipe,
                    inputs: [{ itemId: 'item1', amount: 1 }],
                    outputs: [{ itemId: 'item1', amount: 1 }],
                },
            ],
        };

        const issues = checkGameDataConsistency(loopData);
        expect(issues.some(issue => issue.type === 'warning')).toBe(true);
    });
});
