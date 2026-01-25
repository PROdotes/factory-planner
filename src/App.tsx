import { useState, useEffect } from 'react';
import { AppShell } from '@components/layout/AppShell';
import { Canvas } from '@components/canvas/Canvas';
import { GameDataEditor } from './components/modals/GameDataEditor/GameDataEditor';
import { RecipePicker } from './components/modals/RecipePicker/RecipePicker';
import { ConnectPicker } from './components/modals/ConnectPicker/ConnectPicker';
import { useLayoutStore } from './stores/layoutStore';

import { Recipe } from './types/game';

function App() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const addBlock = useLayoutStore((state) => state.addBlock);
  const activePort = useLayoutStore((state) => state.activePort);
  const setActivePort = useLayoutStore((state) => state.setActivePort);
  const loadFromStorage = useLayoutStore((state) => state.loadFromStorage);

  // Auto-load on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Global escape key handler to clear all modal states
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditorOpen(false);
        setIsPickerOpen(false);
        setActivePort(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePort]);

  const handleRecipeSelect = (recipe: Recipe) => {
    addBlock(recipe.id, { x: 100, y: 100 });
    setIsPickerOpen(false);
  };

  return (
    <AppShell
      onOpenEditor={() => setIsEditorOpen(true)}
      onAddBlock={() => setIsPickerOpen(true)}
    >
      <Canvas />

      {isEditorOpen && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center p-10 backdrop-blur-sm"
          onClick={() => setIsEditorOpen(false)}
        >
          <div
            className="w-full h-full max-w-6xl border border-border rounded-lg overflow-hidden shadow-2xl relative bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsEditorOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center w-8 h-8"
            >
              ✕
            </button>
            <GameDataEditor />
          </div>
        </div>
      )}

      {isPickerOpen && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center p-20 backdrop-blur-sm"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="w-full max-w-3xl h-[600px] border border-border rounded-xl overflow-hidden shadow-2xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <RecipePicker
              onSelect={handleRecipeSelect}
              onCancel={() => setIsPickerOpen(false)}
            />
          </div>
        </div>
      )}

      {activePort && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center p-20 backdrop-blur-sm"
          onClick={() => setActivePort(null)}
        >
          <div
            className="w-full max-w-xl h-[500px] border border-border rounded-xl overflow-hidden shadow-2xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <ConnectPicker
              onCancel={() => setActivePort(null)}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default App;
