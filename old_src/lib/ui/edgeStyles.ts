import { EdgeStatus } from '@/types/block';
import { ItemCategory } from '@/types/game';

export const getCategoryColor = (
    status: EdgeStatus,
    itemColor: string | undefined,
    category: ItemCategory | undefined
): string => {
    if (status === 'conflict') return '#f43f5e';
    if (status === 'mismatch') return '#a855f7';
    if (status === 'overload') return '#ef4444';
    if (status === 'underload') return '#fbbf24';

    if (itemColor) return itemColor;

    switch (category) {
        case 'ore': return '#64748b';
        case 'ingot': return '#b45309';
        case 'component': return '#2563eb';
        case 'product': return '#059669';
        case 'science': return '#0891b2';
        case 'fluid': return '#9333ea';
        default: return '#334155';
    }
};
