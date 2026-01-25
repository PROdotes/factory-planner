import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Recipe } from '@/types/game';

interface RecipePickerProps {
    onSelect: (recipe: Recipe) => void;
    onCancel: () => void;
}

export const RecipePicker: React.FC<RecipePickerProps> = ({ onSelect, onCancel }) => {
    const { game } = useGameStore();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const categories = useMemo(() => {
        const cats = new Set(game.recipes.map(r => r.category));
        return ['all', ...Array.from(cats)].sort();
    }, [game.recipes]);

    const filteredRecipes = useMemo(() => {
        return game.recipes.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = activeCategory === 'all' || r.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [game.recipes, search, activeCategory]);

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold italic tracking-wider text-blue-400">SELECT RECIPE</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search recipes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />

                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight transition-all ${activeCategory === cat
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredRecipes.map(recipe => (
                        <button
                            key={recipe.id}
                            onClick={() => onSelect(recipe)}
                            className="group p-3 bg-gray-800 border border-transparent hover:border-blue-500 rounded-xl transition-all text-left flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8 transition-all group-hover:bg-blue-500/10" />

                            <div className="relative">
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block mb-1">
                                    {recipe.category}
                                </span>
                                <span className="font-bold text-gray-100 group-hover:text-white transition-colors text-sm">
                                    {recipe.name}
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between pointer-events-none">
                                <div className="flex -space-x-1 overflow-hidden">
                                    {/* Simple visual for inputs */}
                                    {recipe.inputs.slice(0, 3).map((input, i) => (
                                        <div key={i} className="w-5 h-5 rounded-md bg-gray-700 border border-gray-600 flex items-center justify-center text-[8px] font-bold" title={input.itemId}>
                                            {input.itemId.slice(0, 1).toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-gray-500 text-[10px] font-bold">
                                    {recipe.craftingTime}s
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredRecipes.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20">
                        <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="font-medium">No recipes found matching your search</p>
                    </div>
                )}
            </div>
        </div>
    );
};
