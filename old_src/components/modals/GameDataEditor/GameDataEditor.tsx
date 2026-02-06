import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { importGameData, exportGameData } from '@/lib/io/gameData';
import { useLayoutStore } from '@/stores/layoutStore';
import { Item, Recipe, Machine, BeltTier } from '@/types/game';
import { ItemForm } from './ItemForm';
import { RecipeForm } from './RecipeForm';
import { MachineForm } from './MachineForm';
import { BeltForm } from './BeltForm';
import { ItemsTab } from './ItemsTab';
import { RecipesTab } from './RecipesTab';
import { MachinesTab } from './MachinesTab';
import { BeltsTab } from './BeltsTab';
import { PacksTab } from './PacksTab';

type Tab = 'items' | 'recipes' | 'machines' | 'belts' | 'packs';

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
        loadGameData, loadPack, resetToDefault
    } = useGameStore();

    const { resetLayout } = useLayoutStore();

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

    const handleSaveMachine = (machine: Machine) => {
        if (isCreating) {
            addMachine(machine);
        } else {
            updateMachine(machine.id, machine);
        }
        setSelectedId(null);
        setIsCreating(false);
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

    const handleDeleteBelt = (id: string) => {
        if (confirm('Are you sure you want to delete this belt?')) {
            deleteBelt(id);
            setSelectedId(null);
            setIsCreating(false);
        }
    };

    const handleCreateClick = () => {
        setSelectedId(null);
        setIsCreating(true);
    };

    const handleExport = () => {
        const data = exportGameData(game);
        // Copying/exporting data — use warn to avoid lint no-console rule or remove for production
        console.warn('Exported game data (truncated):', data.slice(0, 200));
        if (navigator.clipboard) {
            navigator.clipboard.writeText(data).then(() => alert('Game Data copied to clipboard!')).catch(err => console.error(err));
        } else {
            alert('Check console for exported data.');
        }
    };

    const handleImport = () => {
        const json = prompt('Paste Game Data JSON (full export):');
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

    const renderEditor = () => {
        if (activeTab === 'items') {
            const selectedItem = selectedId ? game.items.find((item) => item.id === selectedId) : null;
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
            const selectedRecipe = selectedId ? game.recipes.find((recipe) => recipe.id === selectedId) : null;
            if (selectedId && !selectedRecipe && !isCreating) return <div>Recipe not found</div>;

            if (selectedRecipe || isCreating) {
                return (
                    <RecipeForm
                        initialData={selectedRecipe}
                        isCreating={isCreating}
                        availableItems={game.items}
                        availableMachines={game.machines}
                        settings={game.settings}
                        onSave={handleSaveRecipe}
                        onDelete={handleDeleteRecipe}
                        onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                    />
                );
            }
        }

        if (activeTab === 'machines') {
            const selectedMachine = selectedId ? game.machines.find((machine) => machine.id === selectedId) : null;
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
            const selectedBelt = selectedId ? game.belts.find((belt) => belt.id === selectedId) : null;
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

        if (activeTab === 'packs') {
            return (
                <PacksTab
                    game={game}
                    onResetLayout={resetLayout}
                    onLoadPack={loadPack}
                    onResetToDefault={resetToDefault}
                    onImportPack={handleImport}
                />
            );
        }

        return <div className="text-gray-500 text-center mt-10">Select an item to edit</div>;
    };

    return (
        <div className="flex h-full bg-gray-900 text-white">
            <div className="w-1/3 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold mb-4">Editor</h2>
                    <div className="flex space-x-2 text-sm">
                        {(['items', 'recipes', 'machines', 'belts', 'packs'] as Tab[]).map((tab) => (
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

                {activeTab === 'packs' && (
                    <div className="p-4 space-y-4 border-b border-gray-700">
                        <button
                            onClick={() => {
                                if (confirm('Reset all game data to DSP defaults? This will NOT clear your layout, but might break machines if current nodes use non-existent recipes.')) {
                                    resetToDefault();
                                }
                            }}
                            className="w-full py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 rounded text-xs font-bold transition-all"
                        >
                            Reset to Default (DSP)
                        </button>
                    </div>
                )}

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
                        <ItemsTab items={game.items} selectedId={selectedId} onSelect={setSelectedId} />
                    )}
                    {activeTab === 'recipes' && (
                        <RecipesTab recipes={game.recipes} selectedId={selectedId} onSelect={setSelectedId} />
                    )}
                    {activeTab === 'machines' && (
                        <MachinesTab machines={game.machines} selectedId={selectedId} onSelect={setSelectedId} />
                    )}
                    {activeTab === 'belts' && (
                        <BeltsTab belts={game.belts} selectedId={selectedId} onSelect={setSelectedId} />
                    )}
                </div>
            </div>

            <div className="w-2/3 p-6">
                {renderEditor()}
            </div>
        </div>
    );
};
