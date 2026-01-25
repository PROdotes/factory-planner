import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../gameStore';
import { DSP_DATA } from '@/data/dsp';
import { Recipe, Item, Machine, BeltTier } from '@/types/game';

describe('useGameStore', () => {
    beforeEach(() => {
        useGameStore.getState().resetToDefault();
    });

    it('should initialize with default data', () => {
        const { game } = useGameStore.getState();
        expect(game.recipes.length).toBe(DSP_DATA.recipes.length);
        expect(game.items.length).toBe(DSP_DATA.items.length);
    });

    it('should add a custom recipe', () => {
        const newRecipe: Recipe = {
            id: 'custom-recipe',
            name: 'Custom Recipe',
            machineId: 'arc-smelter',
            inputs: [],
            outputs: [],
            craftingTime: 1,
            category: 'smelting',
            isCustom: true
        };

        useGameStore.getState().addRecipe(newRecipe);

        const { game } = useGameStore.getState();
        expect(game.recipes.find(r => r.id === 'custom-recipe')).toBeDefined();
        expect(game.recipes.length).toBe(DSP_DATA.recipes.length + 1);
    });

    it('should not add duplicate recipes', () => {
        const recipe = useGameStore.getState().game.recipes[0];
        useGameStore.getState().addRecipe(recipe);

        expect(useGameStore.getState().game.recipes.length).toBe(DSP_DATA.recipes.length);
    });

    it('should delete a recipe', () => {
        const recipeId = DSP_DATA.recipes[0].id;
        useGameStore.getState().deleteRecipe(recipeId);

        expect(useGameStore.getState().game.recipes.find(r => r.id === recipeId)).toBeUndefined();
    });

    it('should add and retrieve a custom item', () => {
        const newItem: Item = {
            id: 'custom-item',
            name: 'Custom Item',
            category: 'ore',
            stackSize: 100,
            isCustom: true
        };

        useGameStore.getState().addItem(newItem);

        expect(useGameStore.getState().getItem('custom-item')).toEqual(newItem);
    });

    it('should update an existing item', () => {
        useGameStore.getState().updateItem('iron-ore', { name: 'Iron Ore Updated', stackSize: 200 });

        const updated = useGameStore.getState().getItem('iron-ore');
        expect(updated?.name).toBe('Iron Ore Updated');
        expect(updated?.stackSize).toBe(200);
    });

    it('should delete an item', () => {
        useGameStore.getState().deleteItem('iron-ore');

        expect(useGameStore.getState().getItem('iron-ore')).toBeUndefined();
    });

    it('should update a recipe', () => {
        useGameStore.getState().updateRecipe('iron-ingot', { craftingTime: 2.5 });

        const recipe = useGameStore.getState().getRecipe('iron-ingot');
        expect(recipe?.craftingTime).toBe(2.5);
    });

    it('should add and update a machine', () => {
        const newMachine: Machine = {
            id: 'custom-machine',
            name: 'Custom Machine',
            category: 'smelter',
            speed: 1,
            size: { width: 2, height: 2 },
            isCustom: true,
        };

        useGameStore.getState().addMachine(newMachine);
        useGameStore.getState().updateMachine('custom-machine', { speed: 1.5 });

        const machine = useGameStore.getState().getMachine('custom-machine');
        expect(machine?.speed).toBe(1.5);
    });

    it('should add, update, and delete a belt', () => {
        const newBelt: BeltTier = {
            id: 'custom-belt',
            name: 'Custom Belt',
            tier: 4,
            itemsPerSecond: 60,
            color: '#FFFFFF',
        };

        useGameStore.getState().addBelt(newBelt);
        useGameStore.getState().updateBelt('custom-belt', { itemsPerSecond: 75 });
        const updated = useGameStore.getState().game.belts.find(b => b.id === 'custom-belt');
        expect(updated?.itemsPerSecond).toBe(75);

        useGameStore.getState().deleteBelt('custom-belt');
        const deleted = useGameStore.getState().game.belts.find(b => b.id === 'custom-belt');
        expect(deleted).toBeUndefined();
    });

    it('should load and reset game data', () => {
        const customData = structuredClone(DSP_DATA);
        customData.name = 'Custom DSP';
        useGameStore.getState().loadGameData(customData);

        expect(useGameStore.getState().game.name).toBe('Custom DSP');

        useGameStore.getState().resetToDefault();
        expect(useGameStore.getState().game.name).toBe(DSP_DATA.name);
    });
});
