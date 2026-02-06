/**
 * ROLE: UI Component (Catalog)
 * PURPOSE: Searchable list of all recipes and basic factory components.
 * RELATION: Rendered inside LeftSidebar. Uses useRecipeCatalog.
 */

import { useRecipeCatalog } from '../hooks/useRecipeCatalog';
import { useFactoryStore } from '../../factory/factoryStore';
import { ItemIcon } from '../blocks/ItemIcon';
import { Search, Upload, GitBranch, GitMerge } from 'lucide-react';
import { DragSpawnPayload } from '../hooks/useDragToSpawn';

export function ForgeList() {
    const { categories, recipesByCategory, search, setSearch } = useRecipeCatalog();
    const { addBlock, addSink, addLogistics, setRecipe } = useFactoryStore();

    const handleDragStart = (e: React.MouseEvent, payload: DragSpawnPayload) => {
        window.dispatchEvent(new CustomEvent('spawn-drag-start', {
            detail: {
                clientX: e.clientX,
                clientY: e.clientY,
                payload
            }
        }));
    };

    return (
        <div className="forge-list">
            <div className="forge-search">
                <Search size={14} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search Forge..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="forge-sections">
                <section className="forge-section">
                    <h3>Logistics</h3>
                    <div className="forge-grid">
                        <button
                            className="forge-item-btn"
                            onMouseDown={(e) => handleDragStart(e, { type: 'sink', label: 'Storage' })}
                            onClick={() => addSink("New Storage", window.innerWidth / 2, window.innerHeight / 2)}
                        >
                            <Upload size={16} />
                            <span>Storage</span>
                        </button>
                        <button
                            className="forge-item-btn"
                            onMouseDown={(e) => handleDragStart(e, { type: 'splitter', label: 'Splitter' })}
                            onClick={() => addLogistics("splitter", window.innerWidth / 2, window.innerHeight / 2)}
                        >
                            <GitBranch size={16} />
                            <span>Splitter</span>
                        </button>
                        <button
                            className="forge-item-btn"
                            onMouseDown={(e) => handleDragStart(e, { type: 'merger', label: 'Merger' })}
                            onClick={() => addLogistics("merger", window.innerWidth / 2, window.innerHeight / 2)}
                        >
                            <GitMerge size={16} />
                            <span>Merger</span>
                        </button>
                    </div>
                </section>

                {/* Dynamic sections for all other categories */}
                {categories.map(cat => {
                    const recipes = recipesByCategory[cat];
                    if (recipes.length === 0) return null;

                    // Header styling: specific for Gathering, generic for others
                    const isGathering = cat.toLowerCase() === 'gathering';

                    if (isGathering) {
                        return (
                            <details key={cat} open={!search} className="forge-category gathering-section">
                                <summary>{cat}</summary>
                                <div className="recipe-list">
                                    {recipes.map(recipe => (
                                        <button
                                            key={recipe.id}
                                            className="recipe-row"
                                            onMouseDown={(e) => handleDragStart(e, {
                                                type: 'recipe',
                                                recipeId: recipe.id,
                                                label: recipe.name
                                            })}
                                            onClick={() => {
                                                const block = addBlock(recipe.name, window.innerWidth / 2, window.innerHeight / 2);
                                                setRecipe(block.id, recipe.id);
                                            }}
                                        >
                                            <ItemIcon itemId={recipe.outputs[0]?.itemId} size={20} />
                                            <span className="recipe-name">{recipe.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </details>
                        );
                    }

                    return (
                        <details key={cat} open={!!search} className="forge-category">
                            <summary>{cat}</summary>
                            <div className="recipe-list">
                                {recipes.map(recipe => (
                                    <button
                                        key={recipe.id}
                                        className="recipe-row"
                                        onMouseDown={(e) => handleDragStart(e, {
                                            type: 'recipe',
                                            recipeId: recipe.id,
                                            label: recipe.name
                                        })}
                                        onClick={() => {
                                            const block = addBlock(recipe.name, window.innerWidth / 2, window.innerHeight / 2);
                                            setRecipe(block.id, recipe.id);
                                        }}
                                    >
                                        <ItemIcon itemId={recipe.outputs[0]?.itemId} size={20} />
                                        <span className="recipe-name">{recipe.name}</span>
                                    </button>
                                ))}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );
}
