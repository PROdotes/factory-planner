import { describe, it, expect } from 'vitest';
import { validateGameData, importGameData, exportGameData } from '../gameData';
import { GameDefinition } from '@/types/game';

const MOCK_GAME_DATA: GameDefinition = {
    id: 'dsp',
    name: 'Test Game',
    version: '1.0',
    items: [
        { id: 'iron-ore', name: 'Iron Ore', category: 'ore', stackSize: 100, color: '#000' }
    ],
    recipes: [],
    machines: [
        { id: 'smelter', name: 'Smelter', category: 'smelter', speed: 1, size: { width: 1, height: 1 } }
    ],
    belts: [],
    settings: {
        rateUnit: 'minute',
        lanesPerBelt: 1,
        hasSpeedModifiers: true,
        gridSize: 1
    }
};

describe('Game Data IO', () => {
    it('should validate default valid data', () => {
        const result = validateGameData(MOCK_GAME_DATA);
        expect(result).toEqual(MOCK_GAME_DATA);
    });

    it('should fail validation on invalid schema', () => {
        const invalidData = { ...MOCK_GAME_DATA, items: [{ id: 123 }] }; // Invalid item structure
        expect(() => validateGameData(invalidData)).toThrow();
    });

    it('should export and re-import data correctly', () => {
        const json = exportGameData(MOCK_GAME_DATA);
        const result = importGameData(json);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(MOCK_GAME_DATA);
    });

    it('should handle malformed JSON during import', () => {
        const result = importGameData('{ "broken": json }');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should fail validation on bad categories', () => {
        const invalidData = {
            ...MOCK_GAME_DATA,
            items: [{ ...MOCK_GAME_DATA.items[0], category: 'unknown' }],
        };

        expect(() => validateGameData(invalidData)).toThrow();
    });

    it('should include error messages on invalid import', () => {
        const invalidData = {
            ...MOCK_GAME_DATA,
            machines: [{ ...MOCK_GAME_DATA.machines[0], size: { width: 'bad', height: 1 } }],
        };

        const result = importGameData(JSON.stringify(invalidData));
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });
});
