import React, { useEffect, useState } from 'react';
import { BeltTier } from '@/types/game';
import { toSnakeCase } from '@/lib/utils/stringUtils';

interface BeltFormProps {
    initialData?: BeltTier | null;
    isCreating: boolean;
    onSave: (belt: BeltTier) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export const BeltForm: React.FC<BeltFormProps> = ({
    initialData,
    isCreating,
    onSave,
    onDelete,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<BeltTier>>(initialData || {
        id: '',
        name: '',
        tier: 1,
        itemsPerSecond: 6,
        color: '#666'
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (isCreating) {
            const initialName = 'New Belt';
            setFormData({
                id: toSnakeCase(initialName),
                name: initialName,
                tier: 1,
                itemsPerSecond: 6,
                color: '#666'
            });
        }
    }, [initialData, isCreating]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (formData.id && formData.name) {
            onSave(formData as BeltTier);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <h3 className="text-2xl font-bold mb-6">{isCreating ? 'Create Belt' : 'Edit Belt'}</h3>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="belt-id">ID</label>
                <input
                    id="belt-id"
                    aria-label="ID"
                    type="text"
                    value={formData.id}
                    disabled={true}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="belt-name">Name</label>
                <input
                    id="belt-name"
                    aria-label="Name"
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                        const newName = event.target.value;
                        const updates: Partial<BeltTier> = { name: newName };
                        if (isCreating) {
                            updates.id = toSnakeCase(newName);
                        }
                        setFormData({ ...formData, ...updates });
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="belt-tier">Tier</label>
                <input
                    id="belt-tier"
                    aria-label="Tier"
                    type="number"
                    value={formData.tier}
                    onChange={(event) => setFormData({ ...formData, tier: parseInt(event.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="belt-speed">Speed (items/s)</label>
                <input
                    id="belt-speed"
                    aria-label="Speed (items/s)"
                    type="number"
                    step="0.1"
                    value={formData.itemsPerSecond}
                    onChange={(event) => setFormData({ ...formData, itemsPerSecond: parseFloat(event.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="belt-color">Color</label>
                <div className="flex space-x-2">
                    <input
                        id="belt-color"
                        aria-label="Color"
                        type="color"
                        value={formData.color}
                        onChange={(event) => setFormData({ ...formData, color: event.target.value })}
                        className="h-10 w-20 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={formData.color}
                        onChange={(event) => setFormData({ ...formData, color: event.target.value })}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    />
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
