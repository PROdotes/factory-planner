import React from 'react';
import { Item } from '@/types/game';

interface ItemsTabProps {
    items: Item[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const ItemsTab: React.FC<ItemsTabProps> = ({ items, selectedId, onSelect }) => {
    return (
        <div className="space-y-1">
            {items.map((item) => (
                <div
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`p-2 rounded cursor-pointer ${selectedId === item.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.category}</div>
                </div>
            ))}
        </div>
    );
};
