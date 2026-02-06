import React from 'react';
import { BeltTier } from '@/types/game';

interface BeltsTabProps {
    belts: BeltTier[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const BeltsTab: React.FC<BeltsTabProps> = ({ belts, selectedId, onSelect }) => {
    return (
        <div className="space-y-1">
            {belts.map((belt) => (
                <div
                    key={belt.id}
                    onClick={() => onSelect(belt.id)}
                    className={`p-2 rounded cursor-pointer ${selectedId === belt.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                >
                    <div className="font-medium">{belt.name}</div>
                    <div className="text-xs text-gray-400">{belt.itemsPerSecond} ips</div>
                </div>
            ))}
        </div>
    );
};
