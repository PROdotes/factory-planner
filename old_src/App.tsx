
import { useState, useEffect } from 'react';
import { AppShell } from '@components/layout/AppShell';
import { Canvas } from '@components/canvas/Canvas';
import { GameDataEditor } from './components/modals/GameDataEditor/GameDataEditor';
import { RecipePicker } from './components/modals/RecipePicker/RecipePicker';
import { ConnectPicker } from './components/modals/ConnectPicker/ConnectPicker';
import { useLayoutStore } from './stores/layoutStore';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { DSPIcon } from './components/ui/DSPIcon';
import { useGameStore } from './stores/gameStore';

import { Recipe } from './types/game';

const GlobalGhost = () => {
  const draggingItem = useLayoutStore(state => state.draggingItem);
  const { game } = useGameStore();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!draggingItem) return;
    const handleMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    const handleUp = () => {
      // Small delay to let Canvas.onMouseUp fire first if applicable
      setTimeout(() => useLayoutStore.getState().setDraggingItem(null), 50);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingItem]);

  if (!draggingItem) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999] opacity-70 -translate-x-1/2 -translate-y-1/2 border-2 border-primary/50 bg-primary/10 rounded-lg p-2 backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y }}
    >
      {draggingItem.type === 'splitter' ? (
        <div className="w-10 h-10 flex items-center justify-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0v4" /><path d="M11 21a2 2 0 1 0 4 0 2 2 0 1 0-4 0" /><path d="M7 21a2 2 0 1 0 4 0 2 2 0 1 0-4 0" /><path d="M11 11v6" /></svg>
        </div>
      ) : (
        <div className="w-10 h-10 flex items-center justify-center">
          <DSPIcon
            index={game.items.find(i => i.id === (game.recipes.find(r => r.id === draggingItem.recipeId)?.outputs[0]?.itemId || draggingItem.recipeId))?.iconIndex || 0}
            size={32}
          />
        </div>
      )}
    </div>
  );
};

const AppModals = ({
  isEditorOpen,
  setIsEditorOpen,
  isPickerOpen,
  setIsPickerOpen
}: {
  isEditorOpen: boolean;
  setIsEditorOpen: (v: boolean) => void;
  isPickerOpen: boolean;
  setIsPickerOpen: (v: boolean) => void;
}) => {
  const { project } = useReactFlow();
  const addBlock = useLayoutStore((state) => state.addBlock);

  const handleRecipeSelect = (recipe: Recipe) => {
    // Project center of window to flow space
    const center = project({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    addBlock(recipe.id, center);
    setIsPickerOpen(false);
  };

  return (
    <>
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
    </>
  );
};

function App() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activePort = useLayoutStore((state) => state.activePort);
  const setActivePort = useLayoutStore((state) => state.setActivePort);
  const loadFromStorage = useLayoutStore((state) => state.loadFromStorage);

  // Game Data Loading
  const { ensureDataLoaded, game } = useGameStore();

  // Auto-load on mount
  useEffect(() => {
    ensureDataLoaded();
    loadFromStorage();
  }, [loadFromStorage, ensureDataLoaded]);

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

  if (!game || game.items.length === 0) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-background text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p>Loading Game Data...</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <AppShell
        onOpenEditor={() => setIsEditorOpen(true)}
        onAddBlock={() => setIsPickerOpen(true)}
      >
        <Canvas />
        <GlobalGhost />

        <AppModals
          isEditorOpen={isEditorOpen}
          setIsEditorOpen={setIsEditorOpen}
          isPickerOpen={isPickerOpen}
          setIsPickerOpen={setIsPickerOpen}
        />

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
    </ReactFlowProvider>
  );
}

export default App;
