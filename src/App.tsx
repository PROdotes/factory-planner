/**
 * ROLE: Root Component
 * PURPOSE: High-level layout and global store initialization.
 * RELATION: Orchestrates Game Data loading and Flow Visualization.
 */

import { useEffect } from "react";
import { useGameDataStore } from "./gamedata/gamedataStore";
import { PlannerCanvas } from "./canvas/shell/PlannerCanvas";
import { LeftSidebar } from "./canvas/shell/LeftSidebar";
import { RightSidebar } from "./canvas/shell/RightSidebar";
import { useUIStore } from "./canvas/uiStore";
import {
  Hammer,
  BarChart3,
  Play,
  Target,
  Settings,
  Download,
  Upload,
  Undo2,
  Redo2,
  Save,
  Wand2,
  Trash2,
} from "lucide-react";
import { useFactoryStore } from "./factory/factoryStore";
import { ForgeList } from "./canvas/shell/ForgeList";
import { BalanceTable } from "./canvas/shell/BalanceTable";
import { BottleneckAlerts } from "./canvas/shell/BottleneckAlerts";
import { RateUnitToggle } from "./canvas/components/RateUnitToggle";
import { ImplicitSearchPicker } from "./canvas/blocks/ImplicitSearchPicker";
import { IconMapper } from "./canvas/shell/IconMapper";
import PowerSummary from "./canvas/PowerSummary";

export function App() {
  const loadData = useGameDataStore((s) => s.loadData);
  const isLoaded = useGameDataStore((s) => s.isLoaded);
  const error = useGameDataStore((s) => s.error);

  const runSolver = useFactoryStore((s) => s.runSolver);
  const loadFromLocalStorage = useFactoryStore((s) => s.loadFromLocalStorage);
  const exportToJSON = useFactoryStore((s) => s.exportToJSON);
  const importFromJSON = useFactoryStore((s) => s.importFromJSON);
  const undo = useFactoryStore((s) => s.undo);
  const redo = useFactoryStore((s) => s.redo);
  const saveToLocalStorage = useFactoryStore((s) => s.saveToLocalStorage);
  const autoLayout = useFactoryStore((s) => s.autoLayout);
  const clearFactory = useFactoryStore((s) => s.clearFactory);

  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);
  const focusedNodeId = useUIStore((s) => s.focusedNodeId);
  const toggleFocus = useUIStore((s) => s.toggleFocus);
  const iconMapperOpen = useUIStore((s) => s.iconMapperOpen);
  const setIconMapperOpen = useUIStore((s) => s.setIconMapperOpen);

  useEffect(() => {
    loadData();
    // Auto-load session
    if (localStorage.getItem("dsp_factory_save")) {
      loadFromLocalStorage();
    }
  }, [loadData, loadFromLocalStorage]);

  // [Keyboard Shortcuts]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          undo();
        }
        if (e.key === "y") {
          e.preventDefault();
          redo();
        }
        if (e.key === "s") {
          e.preventDefault();
          saveToLocalStorage();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const {
          selectedBlockId,
          selectedConnectionId,
          removeBlock,
          removeConnection,
        } = useFactoryStore.getState();

        if (selectedBlockId) {
          removeBlock(selectedBlockId);
        } else if (selectedConnectionId) {
          removeConnection(selectedConnectionId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, saveToLocalStorage]);

  // [Solver Watcher] - Ensure rates update when data loads
  useEffect(() => {
    if (isLoaded) {
      runSolver();
    }
  }, [isLoaded, runSolver]);

  if (error) {
    return (
      <div className="error-screen">
        <h1>Initialization Failed</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Synchronizing Dyson Wiki Data...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          DSP Planner <span className="version">v0.1.0</span>
        </div>

        <nav className="app-nav">
          {/* View Toggles */}
          <div className="nav-group">
            <button
              className={`toolbar-btn ${leftSidebarOpen ? "active" : ""}`}
              onClick={toggleLeftSidebar}
              title="Recipe Browser - Add production blocks to your factory"
            >
              <Hammer size={16} /> <span>Recipes</span>
            </button>
            <button
              className={`toolbar-btn ${rightSidebarOpen ? "active" : ""}`}
              onClick={toggleRightSidebar}
              title="Analytics - View bottlenecks and resource balance"
            >
              <BarChart3 size={16} /> <span>Analytics</span>
            </button>
          </div>

          <div className="nav-divider" />

          {/* Main Actions */}
          <div className="nav-group">
            <button
              className="toolbar-btn accent"
              onClick={() => {
                const { autoScale } = useFactoryStore.getState();
                autoScale();
              }}
              title="Auto-scale all machines to meet production targets"
            >
              <Play size={16} /> <span>Balance</span>
            </button>
            <button
              className="toolbar-btn"
              onClick={autoLayout}
              title="Auto-arrange blocks in a clean layout"
            >
              <Wand2 size={16} /> <span>Arrange</span>
            </button>
            {focusedNodeId && (
              <button
                className="toolbar-btn warning"
                onClick={() => toggleFocus(null)}
                title="Exit focus mode - show all blocks"
              >
                <Target size={16} /> <span>Exit Focus</span>
              </button>
            )}
          </div>

          <div className="nav-divider" />

          {/* Rate Display */}
          <RateUnitToggle />

          <div className="nav-divider" />

          {/* Quick Actions */}
          <div className="nav-group compact">
            <button
              className="toolbar-btn icon-only"
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              className="toolbar-btn icon-only"
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
            <button
              className="toolbar-btn icon-only"
              onClick={saveToLocalStorage}
              title="Save to browser (Ctrl+S)"
            >
              <Save size={16} />
            </button>
          </div>

          <div className="nav-group compact">
            <button
              className="toolbar-btn icon-only"
              onClick={exportToJSON}
              title="Export factory as JSON file"
            >
              <Download size={16} />
            </button>
            <label
              className="toolbar-btn icon-only"
              title="Import factory from JSON file"
            >
              <Upload size={16} />
              <input
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = ev.target?.result as string;
                      importFromJSON(content);
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </label>
          </div>

          <div className="nav-divider" />

          {/* Settings & Danger Zone */}
          <div className="nav-group compact">
            <button
              className={`toolbar-btn icon-only ${
                iconMapperOpen ? "active" : ""
              }`}
              onClick={() => setIconMapperOpen(true)}
              title="Settings - Configure icon mappings"
            >
              <Settings size={16} />
            </button>
            <button
              className="toolbar-btn icon-only danger"
              onClick={() => {
                if (confirm("Clear entire factory? This cannot be undone.")) {
                  clearFactory();
                }
              }}
              title="Clear all - Delete entire factory"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </nav>
      </header>

      <main className="app-main">
        <LeftSidebar isOpen={leftSidebarOpen}>
          <ForgeList />
        </LeftSidebar>

        <div className="canvas-container">
          <PlannerCanvas />
        </div>

        <RightSidebar isOpen={rightSidebarOpen}>
          <div className="inspector-section">
            <h3>Factory Network</h3>
            <PowerSummary />
          </div>

          <div className="inspector-section" style={{ marginTop: "24px" }}>
            <h3>Bottlenecks</h3>
            <BottleneckAlerts />
          </div>

          <div className="inspector-section" style={{ marginTop: "24px" }}>
            <h3>Global Balance</h3>
            <BalanceTable />
          </div>
        </RightSidebar>
      </main>

      <ImplicitSearchPicker />
      {iconMapperOpen && (
        <IconMapper onClose={() => setIconMapperOpen(false)} />
      )}

      <footer className="app-footer">
        Logical Flow Layer | Iterative Convergence Solver ACTIVE
      </footer>
    </div>
  );
}
