import React, { useEffect, useState } from 'react';
import { Item, Machine, Recipe, RecipeCategory, GameSettings } from '@/types/game';
import { toSnakeCase } from '@/lib/utils/stringUtils';

interface RecipeFormProps {
    initialData?: Recipe | null;
    isCreating: boolean;
    availableItems: Item[];
    availableMachines: Machine[];
    settings: GameSettings;
    onSave: (recipe: Recipe) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}

export const RecipeForm: React.FC<RecipeFormProps> = ({
    initialData,
    isCreating,
    availableItems,
    availableMachines,
    settings,
    onSave,
    onDelete,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<Recipe>>(initialData || {
        id: '',
        name: '',
        category: 'smelting',
        craftingTime: 1,
        machineId: settings.defaultMachineIds?.['smelting'] || '',
        inputs: [],
        outputs: [],
        isCustom: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (isCreating) {
            const initialName = 'New Recipe';
            const defaultCat: RecipeCategory = 'assembling';
            setFormData({
                id: toSnakeCase(initialName),
                name: initialName,
                category: defaultCat,
                craftingTime: 1,
                machineId: settings.defaultMachineIds?.[defaultCat] || '',
                inputs: [],
                outputs: [],
                isCustom: true
            });
        }
    }, [initialData, isCreating, settings]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (formData.id && formData.name) {
            onSave(formData as Recipe);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <h3 className="text-2xl font-bold mb-6">{isCreating ? 'Create Recipe' : 'Edit Recipe'}</h3>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-id">ID</label>
                <input
                    id="recipe-id"
                    aria-label="ID"
                    type="text"
                    value={formData.id}
                    disabled={true}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-name">Name</label>
                <input
                    id="recipe-name"
                    aria-label="Name"
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                        const newName = event.target.value;
                        const updates: Partial<Recipe> = { name: newName };
                        if (isCreating) {
                            updates.id = toSnakeCase(newName);
                        }
                        setFormData({ ...formData, ...updates });
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="flex space-x-4">
                <div className="flex-1 space-y-2">
                    <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-category">Category</label>
                    <select
                        id="recipe-category"
                        value={formData.category}
                        onChange={(event) => {
                            const newCategory = event.target.value as RecipeCategory;
                            const defaultMachineId = settings.defaultMachineIds?.[newCategory] || '';
                            setFormData({ ...formData, category: newCategory, machineId: defaultMachineId });
                        }}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    >
                        {['smelting', 'assembling', 'refining', 'chemical', 'research', 'mining', 'other'].map((category) => (
                            <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 space-y-2">
                    <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-machine">Machine</label>
                    <select
                        id="recipe-machine"
                        value={formData.machineId}
                        onChange={(event) => setFormData({ ...formData, machineId: event.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select Machine</option>
                        {availableMachines
                            .filter((machine) => !machine.allowedCategories || !formData.category || machine.allowedCategories.includes(formData.category as RecipeCategory))
                            .map((machine) => (
                                <option key={machine.id} value={machine.id}>{machine.name}</option>
                            ))}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-time">Crafting Time (s)</label>
                <input
                    id="recipe-time"
                    aria-label="Crafting Time (s)"
                    type="number"
                    step="0.1"
                    value={formData.craftingTime}
                    onChange={(event) => setFormData({ ...formData, craftingTime: parseFloat(event.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Inputs</label>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, inputs: [...(formData.inputs || []), { itemId: '', amount: 1 }] })}
                        className="text-xs bg-blue-700 px-2 py-1 rounded hover:bg-blue-600"
                    >
                        + Add Input
                    </button>
                </div>
                {formData.inputs?.map((input, index) => (
                    <div key={index} className="flex space-x-2">
                        <select
                            value={input.itemId}
                            onChange={(event) => {
                                const newInputs = [...(formData.inputs || [])];
                                newInputs[index] = { ...input, itemId: event.target.value };
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                            <option value="">Select Item</option>
                            {availableItems.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Amt"
                            value={input.amount}
                            onChange={(event) => {
                                const newInputs = [...(formData.inputs || [])];
                                newInputs[index] = { ...input, amount: parseFloat(event.target.value) };
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newInputs = formData.inputs?.filter((_, inputIndex) => inputIndex !== index);
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="text-red-500 px-2 hover:text-red-400"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Outputs</label>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, outputs: [...(formData.outputs || []), { itemId: '', amount: 1 }] })}
                        className="text-xs bg-blue-700 px-2 py-1 rounded hover:bg-blue-600"
                    >
                        + Add Output
                    </button>
                </div>
                {formData.outputs?.map((output, index) => (
                    <div key={index} className="flex space-x-2">
                        <select
                            value={output.itemId}
                            onChange={(event) => {
                                const newOutputs = [...(formData.outputs || [])];
                                newOutputs[index] = { ...output, itemId: event.target.value };
                                setFormData({ ...formData, outputs: newOutputs });
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                            <option value="">Select Item</option>
                            {availableItems.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Amt"
                            value={output.amount}
                            onChange={(event) => {
                                const newOutputs = [...(formData.outputs || [])];
                                newOutputs[index] = { ...output, amount: parseFloat(event.target.value) };
                                setFormData({ ...formData, outputs: newOutputs });
                            }}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newOutputs = formData.outputs?.filter((_, outputIndex) => outputIndex !== index);
                                setFormData({ ...formData, outputs: newOutputs });
                            }}
                            className="text-red-500 px-2 hover:text-red-400"
                        >
                            ✕
                        </button>
                    </div>
                ))}
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
