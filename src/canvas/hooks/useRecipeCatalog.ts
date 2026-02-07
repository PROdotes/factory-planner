/**
 * ROLE: UI Hook (Data Selector)
 * PURPOSE: Filters and categorizes recipes for the construction catalog (The Forge).
 * RELATION: Reads from GameDataStore, provides data for ForgeList.
 */

import { useMemo, useState } from "react";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { Recipe, Gatherer } from "../../gamedata/gamedata.types";

export function useRecipeCatalog() {
  const { recipes, items, generators, gatherers } = useGameDataStore();
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    Object.values(recipes).forEach((r) => {
      // Filter out special categories handled elsewhere
      if (r.category !== "Gathering") {
        cats.add(r.category);
      }
    });
    return Array.from(cats).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return Object.values(recipes);

    return Object.values(recipes).filter((recipe) => {
      const recipeMatch = recipe.name.toLowerCase().includes(query);
      const outputMatch = recipe.outputs.some((out) => {
        const item = items[out.itemId];
        return item && item.name.toLowerCase().includes(query);
      });
      return recipeMatch || outputMatch;
    });
  }, [recipes, items, search]);

  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, Recipe[]> = {};
    categories.forEach((cat) => {
      grouped[cat] = filteredRecipes
        .filter((r) => r.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    return grouped;
  }, [categories, filteredRecipes]);

  const filteredGenerators = useMemo(() => {
    const query = search.trim().toLowerCase();
    const genList = Object.values(generators);
    if (!query) return genList;

    return genList.filter(
      (gen) =>
        gen.name.toLowerCase().includes(query) ||
        gen.id.toLowerCase().includes(query)
    );
  }, [generators, search]);

  const filteredGatherers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const gathererList = Object.values(gatherers) as Gatherer[];
    if (!query) return gathererList;

    return gathererList.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.outputItemId.toLowerCase().includes(query)
    );
  }, [gatherers, search]);

  return {
    categories,
    recipesByCategory,
    generators: filteredGenerators,
    gatherers: filteredGatherers,
    search,
    setSearch,
    filteredRecipes,
  };
}
