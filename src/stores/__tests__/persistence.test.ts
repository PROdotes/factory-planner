import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '../layoutStore';
import { useGameStore } from '../gameStore';
import { GameDefinition, Recipe } from '@/types/game';

// ----------------------------------------------------------------------------
// TEST DATA
// ----------------------------------------------------------------------------
const TEST_RECIPE: Recipe = {
    id: 'test-recipe',
    name: 'Test Recipe',
    machineId: 'test-machine',
    category: 'smelting',
    craftingTime: 1, // 1 sec
    inputs: [],
    outputs: [{ itemId: 'out', amount: 1 }] // 60/min
};

const TEST_GAME: GameDefinition = {
    id: 'dsp',
    name: 'Test Game',
    version: '0.0.1',
    settings: {
        lanesPerBelt: 1,
        hasSpeedModifiers: false,
        rateUnit: 'minute',
        gridSize: 10
    },
    items: [{ id: 'out', name: 'Out', category: 'ore', stackSize: 100 }],
    recipes: [TEST_RECIPE],
    machines: [{
        id: 'test-machine',
        name: 'Machine',
        category: 'smelter',
        speed: 1.0,
        size: { width: 1, height: 1 }
    }],
    belts: [{
        id: 'belt-1', name: 'Belt', tier: 1, itemsPerSecond: 10, color: '#fff'
    }]
};

describe('Persistence & Integirty', () => {
    beforeEach(() => {
        let counter = 0;
        vi.stubGlobal('crypto', {
            randomUUID: () => `test-id-${counter++}`,
        });

        useGameStore.setState({ game: JSON.parse(JSON.stringify(TEST_GAME)) });
        useLayoutStore.setState({ nodes: [], edges: [], activePort: null });
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Save/Load Roundtrip (Import/Export Logic)', () => {
        // 1. Create Layout
        const id = useLayoutStore.getState().addBlock('test-recipe', { x: 100, y: 100 });

        // 2. Export (Simulated)
        const state = useLayoutStore.getState();
        const exportData = JSON.stringify({
            nodes: state.nodes,
            edges: state.edges,
            version: '1.0'
        });

        // 3. Clear
        useLayoutStore.setState({ nodes: [], edges: [] });
        expect(useLayoutStore.getState().nodes).toHaveLength(0);

        // 4. Import
        useLayoutStore.getState().importLayout(exportData);

        // 5. Verify
        const restoredNodes = useLayoutStore.getState().nodes;
        expect(restoredNodes).toHaveLength(1);
        expect(restoredNodes[0].id).toBe(id);
        expect(restoredNodes[0].data.recipeId).toBe('test-recipe');
    });

    it('reacts to Game Data changes (Recipe Edit)', () => {
        // 1. Add Block with default recipe (1s craft time -> 60/min)
        useLayoutStore.getState().addBlock('test-recipe', { x: 0, y: 0 });
        const node = useLayoutStore.getState().nodes[0];

        expect(node.data.actualRate).toBeCloseTo(60);

        // 2. Update Recipe in Game Store (0.5s craft time -> 120/min)
        useGameStore.getState().updateRecipe('test-recipe', { craftingTime: 0.5 });

        // 3. Verify Layout Store updated the block automatically
        // Note: We need to re-fetch the node from the store
        const updatedNode = useLayoutStore.getState().nodes[0];

        // This expectation asserts that the dependency injection / reaction is working
        expect(updatedNode.data.machineCount).toBeCloseTo(0.5);
    });
});
