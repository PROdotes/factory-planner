
import { render, screen, fireEvent } from '@testing-library/react';
import { GameDataEditor } from '../GameDataEditor';
import { useGameStore } from '@/stores/gameStore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GameDataEditor', () => {
    beforeEach(() => {
        useGameStore.getState().resetToDefault();
        window.confirm = vi.fn(() => true);
    });

    it('renders the editor', () => {
        render(<GameDataEditor />);
        expect(screen.getByText('Editor')).toBeInTheDocument();
    });

    it('displays navigation tabs', () => {
        render(<GameDataEditor />);
        expect(screen.getByText('Items')).toBeInTheDocument();
        expect(screen.getByText('Recipes')).toBeInTheDocument();
        expect(screen.getByText('Machines')).toBeInTheDocument();
    });

    it('shows items list by default', () => {
        render(<GameDataEditor />);
        // "Iron Ore" is a standard Item in DSP
        expect(screen.getByText('Iron Ore')).toBeInTheDocument();
        // Should NOT show a recipe name that isn't an item (if distinct)
        // but "Iron Ore" might be both item and recipe name.
        // Let's pick something unique if possible, or just rely on structure.
        // For now, simple presence is good.
    });

    it('switches to recipes tab', () => {
        render(<GameDataEditor />);
        const recipeTab = screen.getByText('Recipes');
        fireEvent.click(recipeTab);

        // "Iron Ingot" recipe (usually same name as item, but let's check for a known recipe)
        // DSP_DATA likely has "Iron Ingot".
        expect(screen.getByText('Iron Ingot')).toBeInTheDocument();
    });

    it('switches to machines tab', () => {
        render(<GameDataEditor />);
        const machineTab = screen.getByText('Machines');
        fireEvent.click(machineTab);

        // "Arc Smelter"
        expect(screen.getByText('Arc Smelter')).toBeInTheDocument();
    });

    it('selects an item to edit', () => {
        render(<GameDataEditor />);
        // Click "Iron Ore"
        fireEvent.click(screen.getByText('Iron Ore'));

        // Expect form fields to be populated
        // We assume we'll use standard inputs with labels
        expect(screen.getByLabelText('Name')).toHaveValue('Iron Ore');
        expect(screen.getByLabelText('Stack Size')).toHaveValue(100); // Standard value
    });

    it('updates an item', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Iron Ore'));

        const nameInput = screen.getByLabelText('Name');
        fireEvent.change(nameInput, { target: { value: 'Iron Ore Updated' } });

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        // Verify update in list
        expect(screen.getByText('Iron Ore Updated')).toBeInTheDocument();

        // Verify in store
        const { game } = useGameStore.getState();
        const item = game.items.find(i => i.id === 'iron-ore');
        expect(item?.name).toBe('Iron Ore Updated');
    });

    it('creates a new item', () => {
        render(<GameDataEditor />);

        // Click "Add Item" button (we need to add this button)
        fireEvent.click(screen.getByText('+ Add Item'));

        // Fill form
        fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'new-item' } });
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Item' } });
        // Select category? For simplicity just text for now or default

        fireEvent.click(screen.getByText('Save'));

        expect(screen.getByText('New Item')).toBeInTheDocument();

        const { game } = useGameStore.getState();
        expect(game.items.find(i => i.id === 'new-item')).toBeDefined();
    });

    it('selects and edits a recipe', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Recipes'));
        fireEvent.click(screen.getByText('Iron Ingot'));

        // Check fields
        expect(screen.getByLabelText('Name')).toHaveValue('Iron Ingot');

        // Edit crafting time
        const timeInput = screen.getByLabelText('Crafting Time (s)');
        fireEvent.change(timeInput, { target: { value: 2.5 } });

        fireEvent.click(screen.getByText('Save'));

        // Verify store
        const { game } = useGameStore.getState();
        const recipe = game.recipes.find(r => r.id === 'iron-ingot');
        expect(recipe?.craftingTime).toBe(2.5);
    });

    it('shows import/export buttons', () => {
        render(<GameDataEditor />);
        expect(screen.getByText('Import')).toBeInTheDocument();
        expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('selects and edits a machine', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Machines'));
        fireEvent.click(screen.getByText('Arc Smelter'));

        // Edit speed
        const speedInput = screen.getByLabelText('Speed');
        fireEvent.change(speedInput, { target: { value: 2.0 } });

        fireEvent.click(screen.getByText('Save'));

        // Verify store
        const { game } = useGameStore.getState();
        const machine = game.machines.find(m => m.id === 'arc-smelter');
        expect(machine?.speed).toBe(2.0);
    });

    it('deletes an item', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Iron Ore'));

        // Find delete button
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);

        // Verify it's gone from the list/store
        const { game } = useGameStore.getState();
        expect(game.items.find(i => i.id === 'iron-ore')).toBeUndefined();
    });

    it('manages belts', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Belts'));

        // Check if standard belt exists
        expect(screen.getByText('Conveyor Belt Mk.I')).toBeInTheDocument();

        // Create new belt
        fireEvent.click(screen.getByText('+ Add Belt'));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Super Belt' } });
        fireEvent.change(screen.getByLabelText('Speed (items/s)'), { target: { value: 60 } });
        fireEvent.click(screen.getByText('Save'));

        expect(screen.getByText('Super Belt')).toBeInTheDocument();
        const { game } = useGameStore.getState();
        expect(game.belts.find(b => b.name === 'Super Belt')).toBeDefined();
    });

    it('imports and loads data', () => {
        render(<GameDataEditor />);
        const exportSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(JSON.stringify(useGameStore.getState().game));

        fireEvent.click(screen.getByText('Import'));

        expect(promptSpy).toHaveBeenCalled();
        expect(exportSpy).toHaveBeenCalledWith('Game Data imported successfully!');

        exportSpy.mockRestore();
        promptSpy.mockRestore();
    });

    it('handles invalid import data', () => {
        render(<GameDataEditor />);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('{"bad": "data"}');

        fireEvent.click(screen.getByText('Import'));

        expect(promptSpy).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalled();

        alertSpy.mockRestore();
        promptSpy.mockRestore();
    });
});
