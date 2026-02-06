import React from 'react';
import { Machine } from '@/types/game';

interface MachinesTabProps {
    machines: Machine[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const MachinesTab: React.FC<MachinesTabProps> = ({ machines, selectedId, onSelect }) => {
    return (
        <div className="space-y-1">
            {machines.map((machine) => (
                <div
                    key={machine.id}
                    onClick={() => onSelect(machine.id)}
                    className={`p-2 rounded cursor-pointer ${selectedId === machine.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                >
                    <div className="font-medium">{machine.name}</div>
                </div>
            ))}
        </div>
    );
};
