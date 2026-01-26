
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
        expect(screen.getByText('Iron Ore')).toBeInTheDocument();
    });

    it('switches to recipes tab', () => {
        render(<GameDataEditor />);
        const recipeTab = screen.getByText('Recipes');
        fireEvent.click(recipeTab);
        expect(screen.getByText('Iron Ingot')).toBeInTheDocument();
    });

    it('switches to machines tab', () => {
        render(<GameDataEditor />);
        const machineTab = screen.getByText('Machines');
        fireEvent.click(machineTab);
        expect(screen.getByText('Arc Smelter')).toBeInTheDocument();
    });

    it('selects an item to edit', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Iron Ore'));
        expect(screen.getByLabelText('Name')).toHaveValue('Iron Ore');
        expect(screen.getByLabelText('Stack Size')).toHaveValue(100);
    });

    it('updates an item', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Iron Ore'));

        const nameInput = screen.getByLabelText('Name');
        fireEvent.change(nameInput, { target: { value: 'Iron Ore Updated' } });

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        expect(screen.getByText('Iron Ore Updated')).toBeInTheDocument();

        const { game } = useGameStore.getState();
        const item = game.items.find(i => i.id === 'iron-ore');
        expect(item?.name).toBe('Iron Ore Updated');
    });

    it('creates a new item with auto-generated ID', () => {
        render(<GameDataEditor />);

        fireEvent.click(screen.getByText('+ Add Item'));

        // ID field should be disabled
        expect(screen.getByLabelText('ID')).toBeDisabled();

        // Fill Name
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Test Item' } });

        // Verify ID was auto-filled (snake_case)
        expect(screen.getByLabelText('ID')).toHaveValue('new_test_item');

        fireEvent.click(screen.getByText('Save'));

        expect(screen.getByText('New Test Item')).toBeInTheDocument();

        const { game } = useGameStore.getState();
        expect(game.items.find(i => i.id === 'new_test_item')).toBeDefined();
    });

    it('selects and edits a recipe', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Recipes'));
        fireEvent.click(screen.getByText('Iron Ingot'));

        expect(screen.getByLabelText('Name')).toHaveValue('Iron Ingot');

        const timeInput = screen.getByLabelText('Crafting Time (s)');
        fireEvent.change(timeInput, { target: { value: 2.5 } });

        fireEvent.click(screen.getByText('Save'));

        const { game } = useGameStore.getState();
        const recipe = game.recipes.find(r => r.id === 'iron-ingot');
        expect(recipe?.craftingTime).toBe(2.5);
    });

    it('edits recipe category and machine', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Recipes'));
        fireEvent.click(screen.getByText('Iron Ingot'));

        // Change category to assembling
        const categorySelect = screen.getByLabelText('Category');
        fireEvent.change(categorySelect, { target: { value: 'assembling' } });

        // Change machine
        const machineSelect = screen.getByLabelText('Machine');
        fireEvent.change(machineSelect, { target: { value: 'assembler-mk1' } });

        fireEvent.click(screen.getByText('Save'));

        const { game } = useGameStore.getState();
        const recipe = game.recipes.find(r => r.id === 'iron-ingot');
        expect(recipe?.category).toBe('assembling');
        expect(recipe?.machineId).toBe('assembler-mk1');
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

        const speedInput = screen.getByLabelText('Speed');
        fireEvent.change(speedInput, { target: { value: 2.0 } });

        fireEvent.click(screen.getByText('Save'));

        const { game } = useGameStore.getState();
        const machine = game.machines.find(m => m.id === 'arc-smelter');
        expect(machine?.speed).toBe(2.0);
    });

    it('deletes an item', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Iron Ore'));

        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);

        const { game } = useGameStore.getState();
        expect(game.items.find(i => i.id === 'iron-ore')).toBeUndefined();
    });

    it('manages belts with auto-generated ID', () => {
        render(<GameDataEditor />);
        fireEvent.click(screen.getByText('Belts'));

        expect(screen.getByText('Conveyor Belt Mk.I')).toBeInTheDocument();

        fireEvent.click(screen.getByText('+ Add Belt'));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Super Belt' } });

        expect(screen.getByLabelText('ID')).toHaveValue('super_belt');

        fireEvent.change(screen.getByLabelText('Speed (items/s)'), { target: { value: 60 } });
        fireEvent.click(screen.getByText('Save'));

        expect(screen.getByText('Super Belt')).toBeInTheDocument();
        const { game } = useGameStore.getState();
        expect(game.belts.find(b => b.id === 'super_belt')).toBeDefined();
    });

    it('imports and loads data', () => {
        render(<GameDataEditor />);
        const exportSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(JSON.stringify(useGameStore.getState().game));

        fireEvent.click(screen.getByText('Import'));

        expect(promptSpy).toHaveBeenCalled();
        expect(exportSpy).toHaveBeenCalledWith('Game Data imported successfully!');

        exportSpy.mockRestore();
        promptSpy.mockRestore();
    });

    it('handles invalid import data', () => {
        render(<GameDataEditor />);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('{"bad": "data"}');

        fireEvent.click(screen.getByText('Import'));

        expect(promptSpy).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalled();

        alertSpy.mockRestore();
        promptSpy.mockRestore();
    });
});
