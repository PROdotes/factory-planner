/**
 * ROLE: UI Component (Catalog)
 * PURPOSE: Searchable list of all recipes and basic factory components.
 * RELATION: Rendered inside LeftSidebar. Uses useRecipeCatalog.
 */

import { useRecipeCatalog } from "../hooks/useRecipeCatalog";
import { useFactoryStore } from "../../factory/factoryStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { computeFactoryAnalytics } from "../../solver/factoryAnalytics";
import { useMemo } from "react";
import { ItemIcon } from "../blocks/ItemIcon";
import { Search, Upload, GitBranch, Zap } from "lucide-react";
import { DragSpawnPayload } from "../hooks/useDragToSpawn";
import { useUIStore } from "../uiStore";

export function ForgeList() {
  const { categories, recipesByCategory, generators, search, setSearch } =
    useRecipeCatalog();
  const { factory, version } = useFactoryStore();
  const { recipes, machines, isLoaded } = useGameDataStore();
  const { windEfficiency } = useUIStore();
  const { addBlock, addLogistics, setRecipe } = useFactoryStore();

  const analytics = useMemo(() => {
    if (!isLoaded) return null;
    return computeFactoryAnalytics(factory, recipes, machines, windEfficiency);
  }, [factory, version, recipes, machines, isLoaded, windEfficiency]);

  const handleDragStart = (e: React.MouseEvent, payload: DragSpawnPayload) => {
    window.dispatchEvent(
      new CustomEvent("spawn-drag-start", {
        detail: {
          clientX: e.clientX,
          clientY: e.clientY,
          payload,
        },
      })
    );
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
              onMouseDown={(e) =>
                handleDragStart(e, { type: "sink", label: "Storage" })
              }
              onClick={() =>
                addBlock(
                  "New Storage",
                  window.innerWidth / 2,
                  window.innerHeight / 2
                )
              }
            >
              <Upload size={16} />
              <span>Storage</span>
            </button>
            <button
              className="forge-item-btn"
              onMouseDown={(e) =>
                handleDragStart(e, { type: "junction", label: "Junction" })
              }
              onClick={() =>
                addLogistics(window.innerWidth / 2, window.innerHeight / 2)
              }
            >
              <GitBranch size={16} />
              <span>Junction</span>
            </button>
          </div>
        </section>

        {generators.length > 0 && (
          <details open={!!search} className="forge-category power-section">
            <summary>Power</summary>
            <div className="recipe-list">
              {generators.map((gen: any) => {
                // Get built count from analytics if available
                const builtCount = analytics?.buildingCounts[gen.id] || 0;

                return (
                  <button
                    key={gen.id}
                    className="recipe-row"
                    onMouseDown={(e) =>
                      handleDragStart(e, {
                        type: "generator",
                        machineId: gen.id,
                        label: gen.name,
                      })
                    }
                    onClick={() => {
                      const { setMachine } = useFactoryStore.getState();
                      const block = addBlock(
                        gen.name,
                        window.innerWidth / 2,
                        window.innerHeight / 2
                      );
                      setMachine(block.id, gen.id);
                    }}
                  >
                    <div className="recipe-info">
                      <Zap size={20} className="gen-icon" />
                      <span className="recipe-name">{gen.name}</span>
                    </div>
                    {builtCount > 0 && (
                      <span className="built-badge">{builtCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {/* Dynamic sections for all other categories */}
        {categories.map((cat) => {
          const recipes = recipesByCategory[cat];
          if (recipes.length === 0) return null;

          // Header styling: specific for Gathering, generic for others
          const isGathering = cat.toLowerCase() === "gathering";

          if (isGathering) {
            return (
              <details
                key={cat}
                open={!search}
                className="forge-category gathering-section"
              >
                <summary>{cat}</summary>
                <div className="recipe-list">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      className="recipe-row"
                      onMouseDown={(e) =>
                        handleDragStart(e, {
                          type: "recipe",
                          recipeId: recipe.id,
                          label: recipe.name,
                        })
                      }
                      onClick={() => {
                        const block = addBlock(
                          recipe.name,
                          window.innerWidth / 2,
                          window.innerHeight / 2
                        );
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
                {recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    className="recipe-row"
                    onMouseDown={(e) =>
                      handleDragStart(e, {
                        type: "recipe",
                        recipeId: recipe.id,
                        label: recipe.name,
                      })
                    }
                    onClick={() => {
                      const block = addBlock(
                        recipe.name,
                        window.innerWidth / 2,
                        window.innerHeight / 2
                      );
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
