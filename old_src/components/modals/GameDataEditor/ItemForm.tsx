import React, { useEffect, useState } from 'react';
import { DSPIcon } from '@/components/ui/DSPIcon';
import { DEFAULT_SPRITE_COLUMNS } from '@/lib/ui/spriteSheet';
import { Item } from '@/types/game';
import { toSnakeCase } from '@/lib/utils/stringUtils';

interface ItemFormProps {
    initialData?: Item | null;
    isCreating: boolean;
    onSave: (item: Item) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export const ItemForm: React.FC<ItemFormProps> = ({
    initialData,
    isCreating,
    onSave,
    onDelete,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<Item>>(initialData || {
        id: '',
        name: '',
        category: 'other',
        stackSize: 100,
        color: '#3b82f6',
        iconIndex: 0,
        isCustom: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (isCreating) {
            const initialName = 'New Item';
            setFormData({
                id: toSnakeCase(initialName),
                name: initialName,
                category: 'other',
                stackSize: 100,
                color: '#3b82f6',
                iconIndex: 0,
                isCustom: true
            });
        }
    }, [initialData, isCreating]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (formData.id && formData.name) {
            onSave(formData as Item);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <h3 className="text-2xl font-bold mb-6">{isCreating ? 'Create Item' : 'Edit Item'}</h3>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-id">ID</label>
                <input
                    id="item-id"
                    aria-label="ID"
                    type="text"
                    value={formData.id}
                    disabled={true}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-name">Name</label>
                <input
                    id="item-name"
                    aria-label="Name"
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                        const newName = event.target.value;
                        const updates: Partial<Item> = { name: newName };
                        if (isCreating) {
                            updates.id = toSnakeCase(newName);
                        }
                        setFormData({ ...formData, ...updates });
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-category">Category</label>
                <select
                    id="item-category"
                    value={formData.category}
                    onChange={(event) => setFormData({ ...formData, category: event.target.value as Item['category'] })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                >
                    {['ore', 'ingot', 'component', 'product', 'science', 'fluid', 'other'].map((category) => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-stack">Stack Size</label>
                <input
                    id="item-stack"
                    aria-label="Stack Size"
                    type="number"
                    value={formData.stackSize}
                    onChange={(event) => setFormData({ ...formData, stackSize: parseInt(event.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-color">Identity Color</label>
                <div className="flex items-center gap-3">
                    <input
                        id="item-color"
                        type="color"
                        value={formData.color || '#3b82f6'}
                        onChange={(event) => setFormData({ ...formData, color: event.target.value })}
                        className="h-10 w-20 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                    />
                    <div
                        className="flex-1 h-10 rounded border border-white/10"
                        style={{ backgroundColor: formData.color || '#3b82f6' }}
                    />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">This color will be used for all belts carrying this item.</p>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-icon">Icon Index</label>
                <div className="flex items-center gap-3">
                    <input
                        id="item-icon"
                        type="number"
                        value={formData.iconIndex || 0}
                        onChange={(event) => setFormData({ ...formData, iconIndex: parseInt(event.target.value) || 0 })}
                        className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-white/5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Preview:</span>
                        <div className="w-8 h-8 flex items-center justify-center">
                            <DSPIcon index={formData.iconIndex || 0} size={32} />
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                    Index in the {DEFAULT_SPRITE_COLUMNS}-column icons.png sprite sheet.
                </p>
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
