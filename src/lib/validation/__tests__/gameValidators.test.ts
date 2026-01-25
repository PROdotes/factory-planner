import { describe, it, expect } from 'vitest';
import { checkGameDataConsistency } from '../gameValidators';
import { DSP_DATA } from '@/data/dsp';

describe('checkGameDataConsistency', () => {
    it('returns no issues for default data', () => {
        const issues = checkGameDataConsistency(DSP_DATA);
        expect(issues).toHaveLength(0);
    });

    it('flags unknown machine references', () => {
        const badData = {
            ...DSP_DATA,
            recipes: [
                {
                    ...DSP_DATA.recipes[0],
                    machineId: 'missing-machine',
                },
            ],
        };

        const issues = checkGameDataConsistency(badData);
        expect(issues.some(issue => issue.message.includes('missing-machine'))).toBe(true);
    });

    it('flags unknown item references', () => {
        const badData = {
            ...DSP_DATA,
            recipes: [
                {
                    ...DSP_DATA.recipes[0],
                    inputs: [{ itemId: 'missing-item', amount: 1 }],
                },
            ],
        };

        const issues = checkGameDataConsistency(badData);
        expect(issues.some(issue => issue.message.includes('missing-item'))).toBe(true);
    });

    it('warns about self-looping recipes', () => {
        const recipe = DSP_DATA.recipes[0];
        const loopData = {
            ...DSP_DATA,
            recipes: [
                {
                    ...recipe,
                    inputs: [{ itemId: recipe.outputs[0].itemId, amount: 1 }],
                    outputs: [{ itemId: recipe.outputs[0].itemId, amount: 1 }],
                },
            ],
        };

        const issues = checkGameDataConsistency(loopData);
        expect(issues.some(issue => issue.type === 'warning')).toBe(true);
    });
});
