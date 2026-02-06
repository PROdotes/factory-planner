import React, { useEffect, useState } from 'react';
import { Machine } from '@/types/game';
import { toSnakeCase } from '@/lib/utils/stringUtils';

interface MachineFormProps {
    initialData?: Machine | null;
    isCreating: boolean;
    onSave: (machine: Machine) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export const MachineForm: React.FC<MachineFormProps> = ({
    initialData,
    isCreating,
    onSave,
    onDelete,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<Machine>>(initialData || {
        id: '',
        name: '',
        category: 'smelter',
        speed: 1.0,
        size: { width: 3, height: 3 },
        isCustom: true,
        powerUsage: 0
    });

    const [unit, setUnit] = useState<'W' | 'kW' | 'MW' | 'GW'>('kW');

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            const powerValue = initialData.powerUsage || 0;
            if (powerValue >= 1_000_000_000) setUnit('GW');
            else if (powerValue >= 1_000_000) setUnit('MW');
            else if (powerValue >= 1_000) setUnit('kW');
            else setUnit('W');
        } else if (isCreating) {
            const initialName = 'New Machine';
            setFormData({
                id: toSnakeCase(initialName),
                name: initialName,
                category: 'smelter',
                speed: 1.0,
                size: { width: 3, height: 3 },
                isCustom: true,
                powerUsage: 0
            });
            setUnit('kW');
        }
    }, [initialData, isCreating]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (formData.id && formData.name) {
            onSave(formData as Machine);
        }
    };

    const multipliers = { W: 1, kW: 1_000, MW: 1_000_000, GW: 1_000_000_000 };
    const power = formData.powerUsage || 0;
    const displayValue = power / multipliers[unit];

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <h3 className="text-2xl font-bold mb-6">{isCreating ? 'Create Machine' : 'Edit Machine'}</h3>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-id">ID</label>
                <input
                    id="machine-id"
                    aria-label="ID"
                    type="text"
                    value={formData.id}
                    disabled={true}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-name">Name</label>
                <input
                    id="machine-name"
                    aria-label="Name"
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                        const newName = event.target.value;
                        const updates: Partial<Machine> = { name: newName };
                        if (isCreating) {
                            updates.id = toSnakeCase(newName);
                        }
                        setFormData({ ...formData, ...updates });
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-category">Category</label>
                <select
                    id="machine-category"
                    value={formData.category}
                    onChange={(event) => setFormData({ ...formData, category: event.target.value as Machine['category'] })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                >
                    {['smelter', 'assembler', 'refinery', 'chemical', 'lab', 'miner', 'other'].map((category) => (
                        <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-speed">Speed</label>
                <input
                    id="machine-speed"
                    aria-label="Speed"
                    type="number"
                    step="0.01"
                    value={formData.speed}
                    onChange={(event) => setFormData({ ...formData, speed: parseFloat(event.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-power">Power Usage</label>
                <div className="flex space-x-2">
                    <input
                        id="machine-power"
                        aria-label="Power Usage Value"
                        type="number"
                        step="0.01"
                        value={displayValue}
                        onChange={(event) => {
                            const value = parseFloat(event.target.value) || 0;
                            setFormData({ ...formData, powerUsage: Math.round(value * multipliers[unit]) });
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={unit}
                        onChange={(event) => setUnit(event.target.value as typeof unit)}
                        className="w-24 px-2 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="W">W</option>
                        <option value="kW">kW</option>
                        <option value="MW">MW</option>
                        <option value="GW">GW</option>
                    </select>
                </div>
            </div>

            <div className="pt-4 flex space-x-2">
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
                >
                    Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                >
                    Cancel
                </button>
                {!isCreating && (
                    <button
                        type="button"
                        onClick={() => onDelete(formData.id!)}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded font-medium transition-colors ml-auto"
                    >
                        Delete
                    </button>
                )}
            </div>
        </form>
    );
};
