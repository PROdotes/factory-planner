import { create } from 'zustand';
import { produce } from 'immer';
import { GameDefinition, Item, Machine, Recipe, BeltTier } from '@/types/game';
import { DSP_DATA } from '@/data/dsp';

interface GameState {
    game: GameDefinition;

    // Helpers
    getRecipe: (id: string) => Recipe | undefined;
    getItem: (id: string) => Item | undefined;
    getMachine: (id: string) => Machine | undefined;

    // CRUD Actions
    // Recipes
    addRecipe: (recipe: Recipe) => void;
    updateRecipe: (id: string, updates: Partial<Recipe>) => void;
    deleteRecipe: (id: string) => void;

    // Items
    addItem: (item: Item) => void;
    updateItem: (id: string, updates: Partial<Item>) => void;
    deleteItem: (id: string) => void;

    // Machines
    addMachine: (machine: Machine) => void;
    updateMachine: (id: string, updates: Partial<Machine>) => void;
    deleteMachine: (id: string) => void;

    // Belts
    addBelt: (belt: BeltTier) => void;
    updateBelt: (id: string, updates: Partial<BeltTier>) => void;
    deleteBelt: (id: string) => void;

    // Bulk Load (for importing packs)
    loadGameData: (data: GameDefinition) => void;
    resetToDefault: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    game: DSP_DATA,

    // ─── Helpers ──────────────────────────────────────────

    getRecipe: (id) => get().game.recipes.find(r => r.id === id),
    getItem: (id) => get().game.items.find(i => i.id === id),
    getMachine: (id) => get().game.machines.find(m => m.id === id),

    // ─── CRUD Actions ─────────────────────────────────────

    // Recipes
    addRecipe: (recipe) => set(produce((state: GameState) => {
        // Prevent duplicates
        if (state.game.recipes.find(r => r.id === recipe.id)) return;
        state.game.recipes.push(recipe);
    })),

    updateRecipe: (id, updates) => set(produce((state: GameState) => {
        const index = state.game.recipes.findIndex(r => r.id === id);
        if (index !== -1) {
            state.game.recipes[index] = { ...state.game.recipes[index], ...updates };
        }
    })),

    deleteRecipe: (id) => set(produce((state: GameState) => {
        state.game.recipes = state.game.recipes.filter(r => r.id !== id);
    })),

    // Items
    addItem: (item) => set(produce((state: GameState) => {
        if (state.game.items.find(i => i.id === item.id)) return;
        state.game.items.push(item);
    })),

    updateItem: (id, updates) => set(produce((state: GameState) => {
        const index = state.game.items.findIndex(i => i.id === id);
        if (index !== -1) {
            state.game.items[index] = { ...state.game.items[index], ...updates };
        }
    })),

    deleteItem: (id) => set(produce((state: GameState) => {
        state.game.items = state.game.items.filter(i => i.id !== id);
    })),

    // Machines
    addMachine: (machine) => set(produce((state: GameState) => {
        if (state.game.machines.find(m => m.id === machine.id)) return;
        state.game.machines.push(machine);
    })),

    updateMachine: (id, updates) => set(produce((state: GameState) => {
        const index = state.game.machines.findIndex(m => m.id === id);
        if (index !== -1) {
            state.game.machines[index] = { ...state.game.machines[index], ...updates };
        }
    })),

    deleteMachine: (id) => set(produce((state: GameState) => {
        state.game.machines = state.game.machines.filter(m => m.id !== id);
    })),

    // Belts
    addBelt: (belt) => set(produce((state: GameState) => {
        if (state.game.belts.find(b => b.id === belt.id)) return;
        state.game.belts.push(belt);
    })),

    updateBelt: (id, updates) => set(produce((state: GameState) => {
        const index = state.game.belts.findIndex(b => b.id === id);
        if (index !== -1) {
            state.game.belts[index] = { ...state.game.belts[index], ...updates };
        }
    })),

    deleteBelt: (id) => set(produce((state: GameState) => {
        state.game.belts = state.game.belts.filter(b => b.id !== id);
    })),

    // data management
    loadGameData: (data) => set({ game: data }),
    resetToDefault: () => set({ game: DSP_DATA }),
}));
