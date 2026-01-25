import { describe, it, expect } from 'vitest';
import { validateGameData, importGameData, exportGameData } from '../gameData';
import { DSP_DATA } from '@/data/dsp';

describe('Game Data IO', () => {
    it('should validate default valid data', () => {
        const result = validateGameData(DSP_DATA);
        expect(result).toEqual(DSP_DATA);
    });

    it('should fail validation on invalid schema', () => {
        const invalidData = { ...DSP_DATA, items: [{ id: 123 }] }; // Invalid item structure
        expect(() => validateGameData(invalidData)).toThrow();
    });

    it('should export and re-import data correctly', () => {
        const json = exportGameData(DSP_DATA);
        const result = importGameData(json);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(DSP_DATA);
    });

    it('should handle malformed JSON during import', () => {
        const result = importGameData('{ "broken": json }');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should fail validation on bad categories', () => {
        const invalidData = {
            ...DSP_DATA,
            items: [{ ...DSP_DATA.items[0], category: 'unknown' }],
        };

        expect(() => validateGameData(invalidData)).toThrow();
    });

    it('should include error messages on invalid import', () => {
        const invalidData = {
            ...DSP_DATA,
            machines: [{ ...DSP_DATA.machines[0], size: { width: 'bad', height: 1 } }],
        };

        const result = importGameData(JSON.stringify(invalidData));
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });
});
