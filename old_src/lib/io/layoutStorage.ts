import { BlockNode } from '@/types/block';
import { Edge } from 'reactflow';
import { z } from 'zod';

export interface LayoutPayload {
    nodes: BlockNode[];
    edges: Edge[];
}

const PositionSchema = z.object({
    x: z.number(),
    y: z.number()
});

const LayoutPayloadSchema = z.object({
    nodes: z.array(z.object({
        id: z.string(),
        position: PositionSchema,
        data: z.unknown()
    }).passthrough()),
    edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string()
    }).passthrough())
});

export const exportLayoutData = (nodes: BlockNode[], edges: Edge[]) => {
    return { nodes, edges, version: '1.0' };
};

export const saveLayoutToStorage = (nodes: BlockNode[], edges: Edge[]) => {
    try {
        localStorage.setItem('dsp_layout', JSON.stringify({ nodes, edges }));
    } catch (error) {
        console.error('Failed to save layout', error);
        alert('Failed to save layout to storage.');
    }
};

export const loadLayoutFromStorage = (): LayoutPayload | null => {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem('dsp_layout');
    } catch (error) {
        console.error('Failed to read layout from storage', error);
        return null;
    }
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as unknown;
        const result = LayoutPayloadSchema.safeParse(parsed);
        if (result.success) {
            return result.data as LayoutPayload;
        }
        console.error('Failed to load layout', result.error);
    } catch (error) {
        console.error('Failed to load layout', error);
    }
    return null;
};

export const parseLayoutImport = (json: string): LayoutPayload | null => {
    try {
        const data = JSON.parse(json) as unknown;
        const result = LayoutPayloadSchema.safeParse(data);
        if (result.success) {
            return result.data as LayoutPayload;
        }
        console.error('Failed to import layout', result.error);
    } catch (error) {
        console.error('Failed to import layout', error);
    }
    return null;
};
