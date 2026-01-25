
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/stores/gameStore';
import { Item, Recipe, Machine, BeltTier } from '@/types/game';
import { importGameData, exportGameData } from '@/lib/io/gameData';

type Tab = 'items' | 'recipes' | 'machines' | 'belts';

export const GameDataEditor: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('items');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const {
        game,
        addItem, updateItem, deleteItem,
        addRecipe, updateRecipe, deleteRecipe,
        addMachine, updateMachine, deleteMachine,
        addBelt, updateBelt, deleteBelt,
        loadGameData
    } = useGameStore();

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedId(null);
        setIsCreating(false);
    }, [activeTab]);

    const handleSaveItem = (item: Item) => {
        if (isCreating) {
            addItem(item);
        } else {
            updateItem(item.id, item);
        }
        setSelectedId(null);
        setIsCreating(false);
    };

    const handleSaveRecipe = (recipe: Recipe) => {
        if (isCreating) {
            addRecipe(recipe);
        } else {
            updateRecipe(recipe.id, recipe);
        }
        setSelectedId(null);
        setIsCreating(false);
    };

    const handleDeleteItem = (id: string) => {
        if (confirm('Are you sure you want to delete this item?')) {
            deleteItem(id);
            setSelectedId(null);
            setIsCreating(false);
        }
    };

    const handleDeleteRecipe = (id: string) => {
        if (confirm('Are you sure you want to delete this recipe?')) {
            deleteRecipe(id);
            setSelectedId(null);
            setIsCreating(false);
        }
    };

    const handleDeleteMachine = (id: string) => {
        if (confirm('Are you sure you want to delete this machine?')) {
            deleteMachine(id);
            setSelectedId(null);
            setIsCreating(false);
        }
    };

    const handleSaveMachine = (machine: Machine) => {
        if (isCreating) {
            addMachine(machine);
        } else {
            updateMachine(machine.id, machine);
        }
        setSelectedId(null);
        setIsCreating(false);
    };

    const handleDeleteBelt = (id: string) => {
        if (confirm('Are you sure you want to delete this belt?')) {
            deleteBelt(id);
            setSelectedId(null);
            setIsCreating(false);
        }
    };

    const handleSaveBelt = (belt: BeltTier) => {
        if (isCreating) {
            addBelt(belt);
        } else {
            updateBelt(belt.id, belt);
        }
        setSelectedId(null);
        setIsCreating(false);
    };

    const handleCreateClick = () => {
        setSelectedId(null);
        setIsCreating(true);
    };

    const handleExport = () => {
        const data = exportGameData(game);
        console.log(data); // Fallback
        // navigator.clipboard might require secure context or permissions
        if (navigator.clipboard) {
            navigator.clipboard.writeText(data).then(() => alert('Game Data copied to clipboard!')).catch(err => console.error(err));
        } else {
            alert('Check console for exported data.');
        }
    };

    const handleImport = () => {
        const json = prompt("Paste Game Data JSON (full export):");
        if (json) {
            const result = importGameData(json);
            if (result.success && result.data) {
                loadGameData(result.data);
                alert('Game Data imported successfully!');
            } else {
                alert('Import failed: ' + result.error);
            }
        }
    };

    const handleItemClick = (id: string) => {
        setSelectedId(id);
        setIsCreating(false);
    };

    const renderEditor = () => {
        if (activeTab === 'items') {
            const selectedItem = selectedId ? game.items.find(i => i.id === selectedId) : null;
            if (selectedId && !selectedItem && !isCreating) return <div>Item not found</div>;

            if (selectedItem || isCreating) {
                return (
                    <ItemForm
                        initialData={selectedItem}
                        isCreating={isCreating}
                        onSave={handleSaveItem}
                        onDelete={handleDeleteItem}
                        onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                    />
                );
            }
        }

        if (activeTab === 'recipes') {
            const selectedRecipe = selectedId ? game.recipes.find(r => r.id === selectedId) : null;
            if (selectedId && !selectedRecipe && !isCreating) return <div>Recipe not found</div>;

            if (selectedRecipe || isCreating) {
                return (
                    <RecipeForm
                        initialData={selectedRecipe}
                        isCreating={isCreating}
                        availableItems={game.items}
                        onSave={handleSaveRecipe}
                        onDelete={handleDeleteRecipe}
                        onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                    />
                );
            }
        }

        if (activeTab === 'machines') {
            const selectedMachine = selectedId ? game.machines.find(m => m.id === selectedId) : null;
            if (selectedId && !selectedMachine && !isCreating) return <div>Machine not found</div>;

            if (selectedMachine || isCreating) {
                return (
                    <MachineForm
                        initialData={selectedMachine}
                        isCreating={isCreating}
                        onSave={handleSaveMachine}
                        onDelete={handleDeleteMachine}
                        onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                    />
                );
            }
        }

        if (activeTab === 'belts') {
            const selectedBelt = selectedId ? game.belts.find(b => b.id === selectedId) : null;
            if (selectedId && !selectedBelt && !isCreating) return <div>Belt not found</div>;

            if (selectedBelt || isCreating) {
                return (
                    <BeltForm
                        initialData={selectedBelt}
                        isCreating={isCreating}
                        onSave={handleSaveBelt}
                        onDelete={handleDeleteBelt}
                        onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                    />
                );
            }
        }

        return <div className="text-gray-500 text-center mt-10">Select an item to edit</div>;
    };

    return (
        <div className="flex h-full bg-gray-900 text-white">
            {/* Sidebar List */}
            <div className="w-1/3 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold mb-4">Editor</h2>
                    <div className="flex space-x-2 text-sm">
                        {(['items', 'recipes', 'machines', 'belts'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-2 py-1 rounded ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-2">
                    <button
                        onClick={handleCreateClick}
                        className="w-full py-2 mb-2 bg-green-700 hover:bg-green-600 rounded text-sm font-bold"
                    >
                        + Add {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
                    </button>
                    <div className="flex space-x-2">
                        <button
                            onClick={handleImport}
                            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                        >
                            Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                        >
                            Export
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'items' && (
                        <div className="space-y-1">
                            {game.items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item.id)}
                                    className={`p-2 rounded cursor-pointer ${selectedId === item.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                                >
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-gray-400">{item.category}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'recipes' && (
                        <div className="space-y-1">
                            {game.recipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    onClick={() => handleItemClick(recipe.id)}
                                    className={`p-2 rounded cursor-pointer ${selectedId === recipe.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                                >
                                    <div className="font-medium">{recipe.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'machines' && (
                        <div className="space-y-1">
                            {game.machines.map(machine => (
                                <div
                                    key={machine.id}
                                    onClick={() => handleItemClick(machine.id)}
                                    className={`p-2 rounded cursor-pointer ${selectedId === machine.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                                >
                                    <div className="font-medium">{machine.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'belts' && (
                        <div className="space-y-1">
                            {game.belts.map(belt => (
                                <div
                                    key={belt.id}
                                    onClick={() => handleItemClick(belt.id)}
                                    className={`p-2 rounded cursor-pointer ${selectedId === belt.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                                >
                                    <div className="font-medium">{belt.name}</div>
                                    <div className="text-xs text-gray-400">{belt.itemsPerSecond} ips</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Form */}
            <div className="w-2/3 p-6">
                {renderEditor()}
            </div>
        </div>
    );
};

const ItemForm: React.FC<{
    initialData?: Item | null;
    isCreating: boolean;
    onSave: (item: Item) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ initialData, isCreating, onSave, onDelete, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Item>>(initialData || {
        id: '',
        name: '',
        category: 'other',
        stackSize: 100,
        isCustom: true
    });

    // Update form when selection changes
    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (isCreating) {
            setFormData({
                id: uuidv4(),
                name: 'New Item',
                category: 'other',
                stackSize: 100,
                isCustom: true
            });
        }
    }, [initialData, isCreating]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                    id="item-id" // Matching label htmlFor
                    aria-label="ID" // For testing
                    type="text"
                    value={formData.id}
                    disabled={!isCreating}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="item-category">Category</label>
                <select
                    id="item-category"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                >
                    {['ore', 'ingot', 'component', 'product', 'science', 'fluid', 'other'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
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
                    onChange={e => setFormData({ ...formData, stackSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
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

const RecipeForm: React.FC<{
    initialData?: Recipe | null;
    isCreating: boolean;
    availableItems: Item[];
    onSave: (recipe: Recipe) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ initialData, isCreating, availableItems, onSave, onDelete, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Recipe>>(initialData || {
        id: '',
        name: '',
        category: 'smelting',
        craftingTime: 1,
        machineId: '',
        inputs: [],
        outputs: [],
        isCustom: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else if (isCreating) {
            setFormData({
                id: uuidv4(),
                name: 'New Recipe',
                category: 'smelting',
                craftingTime: 1,
                machineId: '',
                inputs: [],
                outputs: [],
                isCustom: true
            });
        }
    }, [initialData, isCreating]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                    disabled={!isCreating}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="recipe-time">Crafting Time (s)</label>
                <input
                    id="recipe-time"
                    aria-label="Crafting Time (s)"
                    type="number"
                    step="0.1"
                    value={formData.craftingTime}
                    onChange={e => setFormData({ ...formData, craftingTime: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            {/* Inputs Editor */}
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
                {formData.inputs?.map((input, idx) => (
                    <div key={idx} className="flex space-x-2">
                        <select
                            value={input.itemId}
                            onChange={e => {
                                const newInputs = [...(formData.inputs || [])];
                                newInputs[idx] = { ...input, itemId: e.target.value };
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                            <option value="">Select Item</option>
                            {availableItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Amt"
                            value={input.amount}
                            onChange={e => {
                                const newInputs = [...(formData.inputs || [])];
                                newInputs[idx] = { ...input, amount: parseFloat(e.target.value) };
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newInputs = formData.inputs?.filter((_, i) => i !== idx);
                                setFormData({ ...formData, inputs: newInputs });
                            }}
                            className="text-red-500 px-2 hover:text-red-400"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {/* Outputs Editor */}
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
                {formData.outputs?.map((output, idx) => (
                    <div key={idx} className="flex space-x-2">
                        <select
                            value={output.itemId}
                            onChange={e => {
                                const newOutputs = [...(formData.outputs || [])];
                                newOutputs[idx] = { ...output, itemId: e.target.value };
                                setFormData({ ...formData, outputs: newOutputs });
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                            <option value="">Select Item</option>
                            {availableItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Amt"
                            value={output.amount}
                            onChange={e => {
                                const newOutputs = [...(formData.outputs || [])];
                                newOutputs[idx] = { ...output, amount: parseFloat(e.target.value) };
                                setFormData({ ...formData, outputs: newOutputs });
                            }}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newOutputs = formData.outputs?.filter((_, i) => i !== idx);
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
        </form >
    );
};

const MachineForm: React.FC<{
    initialData?: Machine | null;
    isCreating: boolean;
    onSave: (machine: Machine) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ initialData, isCreating, onSave, onDelete, onCancel }) => {
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
            // Auto-detect best unit for existing power
            const p = initialData.powerUsage || 0;
            if (p >= 1_000_000_000) setUnit('GW');
            else if (p >= 1_000_000) setUnit('MW');
            else if (p >= 1_000) setUnit('kW');
            else setUnit('W');
        } else if (isCreating) {
            setFormData({
                id: uuidv4(),
                name: 'New Machine',
                category: 'smelter',
                speed: 1.0,
                size: { width: 3, height: 3 },
                isCustom: true,
                powerUsage: 0
            });
            setUnit('kW');
        }
    }, [initialData, isCreating]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                    disabled={!isCreating}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300" htmlFor="machine-category">Category</label>
                <select
                    id="machine-category"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                >
                    {['smelter', 'assembler', 'refinery', 'chemical', 'lab', 'miner', 'other'].map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
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
                    onChange={e => setFormData({ ...formData, speed: parseFloat(e.target.value) })}
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
                        onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, powerUsage: Math.round(val * multipliers[unit]) });
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={unit}
                        onChange={e => setUnit(e.target.value as any)}
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

const BeltForm: React.FC<{
    initialData?: BeltTier | null;
    isCreating: boolean;
    onSave: (belt: BeltTier) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ initialData, isCreating, onSave, onDelete, onCancel }) => {
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
            setFormData({
                id: uuidv4(),
                name: 'New Belt',
                tier: 1,
                itemsPerSecond: 6,
                color: '#666'
            });
        }
    }, [initialData, isCreating]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                    disabled={!isCreating}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, tier: parseInt(e.target.value) })}
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
                    onChange={e => setFormData({ ...formData, itemsPerSecond: parseFloat(e.target.value) })}
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
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        className="h-10 w-20 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
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

