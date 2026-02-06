import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLayoutFromStorage, parseLayoutImport, saveLayoutToStorage } from '../layoutStorage';

describe('layoutStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('loads a valid layout from storage', () => {
        const payload = {
            nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }],
            edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
        };
        localStorage.setItem('dsp_layout', JSON.stringify(payload));
        const result = loadLayoutFromStorage();
        expect(result).toEqual(payload);
    });

    it('returns null for malformed storage json', () => {
        localStorage.setItem('dsp_layout', '{bad json');
        const result = loadLayoutFromStorage();
        expect(result).toBeNull();
    });

    it('returns null for invalid layout shape', () => {
        localStorage.setItem('dsp_layout', JSON.stringify({ nodes: 'bad', edges: [] }));
        const result = loadLayoutFromStorage();
        expect(result).toBeNull();
    });

    it('handles storage write failures', () => {
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        expect(() => saveLayoutToStorage([], [])).not.toThrow();
        setItemSpy.mockRestore();
    });

    it('parses valid layout import json', () => {
        const payload = {
            nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }],
            edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
        };
        const result = parseLayoutImport(JSON.stringify(payload));
        expect(result).toEqual(payload);
    });

    it('rejects invalid layout import json', () => {
        const result = parseLayoutImport(JSON.stringify({ nodes: [], edges: 'bad' }));
        expect(result).toBeNull();
    });
});
