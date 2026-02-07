/**
 * ROLE: UI Component (Contextual Construction)
 * PURPOSE: Offers a list of blocks that either consume or produce the item being dragged.
 * RELATION: Triggered by ConnectionLines on "Drop to Empty Space".
 */

import { useMemo, useEffect, useRef } from "react";
import { useUIStore } from "../uiStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useFactoryStore } from "../../factory/factoryStore";
import { ItemIcon } from "./ItemIcon";
import { GitBranch, X } from "lucide-react";

export function ImplicitSearchPicker() {
  const { implicitSearch, setImplicitSearch } = useUIStore();
  const { recipes, items, gatherers } = useGameDataStore();
  const {
    addBlock,
    setRecipe,
    addLogistics,
    connect,
    runSolver,
    addGatherer,
    setGatherer,
  } = useFactoryStore();
  const pickerRef = useRef<HTMLDivElement>(null);

  // Filter recipes based on the dragged item
  const results = useMemo(() => {
    if (!implicitSearch) return [];
    const { itemId, side } = implicitSearch;

    return Object.values(recipes).filter((recipe) => {
      if (side === "right") {
        // Dragging Output -> Find Consumers (where itemId is an input)
        return recipe.inputs.some((inp) => inp.itemId === itemId);
      } else {
        // Dragging Input -> Find Producers (where itemId is an output)
        return recipe.outputs.some((out) => out.itemId === itemId);
      }
    });
  }, [implicitSearch, recipes]);

  const matchingGatherers = useMemo(() => {
    if (!implicitSearch || implicitSearch.side === "right") return [];
    const { itemId } = implicitSearch;
    return Object.values(gatherers).filter((g) => g.outputItemId === itemId);
  }, [implicitSearch, gatherers]);

  // Handle clicks outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setImplicitSearch(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImplicitSearch(null);
    };

    if (implicitSearch) {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [implicitSearch, setImplicitSearch]);

  if (!implicitSearch) return null;

  const { blockId, itemId, side, worldPos, clientPos } = implicitSearch;
  const itemName = items[itemId]?.name || itemId;

  const handleSelectRecipe = (recipeId: string, recipeName: string) => {
    const newBlock = addBlock(recipeName, worldPos.x, worldPos.y);
    setRecipe(newBlock.id, recipeId);

    // Auto-connect
    if (side === "right") {
      connect(blockId, newBlock.id, itemId);
    } else {
      connect(newBlock.id, blockId, itemId);
    }

    runSolver();
    setImplicitSearch(null);
  };

  const handleSelectLogistics = () => {
    const newBlock = addLogistics(worldPos.x, worldPos.y);

    // Auto-connect
    if (side === "right") {
      connect(blockId, newBlock.id, itemId);
    } else {
      connect(newBlock.id, blockId, itemId);
    }

    runSolver();
    setImplicitSearch(null);
  };

  const handleSelectGatherer = (gathererId: string, gathererName: string) => {
    const newBlock = addGatherer(gathererName, worldPos.x, worldPos.y);
    setGatherer(newBlock.id, gathererId);

    // Auto-connect
    // Side is left (input looking for producer), so connect gatherer (newBlock) TO blockId
    connect(newBlock.id, blockId, itemId);

    runSolver();
    setImplicitSearch(null);
  };

  return (
    <div
      className="implicit-picker"
      ref={pickerRef}
      style={{
        top: clientPos.y,
        left: clientPos.x,
      }}
    >
      <div className="picker-header">
        <ItemIcon itemId={itemId} size={16} />
        <span>
          {side === "right" ? "Who consumes" : "Who produces"} <b>{itemName}</b>
          ?
        </span>
        <button className="close-btn" onClick={() => setImplicitSearch(null)}>
          <X size={14} />
        </button>
      </div>

      <div className="picker-body">
        <div className="picker-section">
          <div className="section-title">Logistics & Storage</div>
          <div className="logistics-grid">
            <button className="picker-item-btn" onClick={handleSelectLogistics}>
              <GitBranch size={16} />
              <span>Junction</span>
            </button>
          </div>
        </div>

        {matchingGatherers.length > 0 && (
          <div className="picker-section">
            <div className="section-title">Gathering</div>
            <div className="recipe-grid">
              {matchingGatherers.map((g) => (
                <button
                  key={g.id}
                  className="picker-recipe-btn"
                  onClick={() => handleSelectGatherer(g.id, g.name)}
                >
                  <ItemIcon itemId={g.outputItemId} size={20} />
                  <span>{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="picker-section">
            <div className="section-title">Recipes</div>
            <div className="recipe-grid">
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  className="picker-recipe-btn"
                  onClick={() => handleSelectRecipe(recipe.id, recipe.name)}
                >
                  <ItemIcon
                    itemId={
                      side === "right"
                        ? recipe.outputs[0]?.itemId
                        : recipe.outputs[0]?.itemId
                    }
                    size={20}
                  />
                  <span>{recipe.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="picker-empty">
            No recipes found that {side === "right" ? "use" : "produce"} this
            item.
          </div>
        )}
      </div>
    </div>
  );
}
