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
  const { loadData, isLoaded, error } = useGameDataStore();
  const {
    runSolver,
    loadFromLocalStorage,
    exportToJSON,
    importFromJSON,
    undo,
    redo,
    saveToLocalStorage,
    autoLayout,
    clearFactory,
  } = useFactoryStore();
  const {
    leftSidebarOpen,
    toggleLeftSidebar,
    rightSidebarOpen,
    toggleRightSidebar,
    focusedNodeId,
    toggleFocus,
    iconMapperOpen,
    setIconMapperOpen,
  } = useUIStore();

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
          <div className="nav-group">
            <span className="nav-group-label">Panels</span>
            <button
              className={`toolbar-btn ${leftSidebarOpen ? "primary" : ""}`}
              onClick={toggleLeftSidebar}
              title="Toggle Forge (Recipe Catalog)"
            >
              <Hammer size={18} /> <span>Forge</span>
            </button>
            <button
              className={`toolbar-btn ${rightSidebarOpen ? "primary" : ""}`}
              onClick={toggleRightSidebar}
              title="Toggle Analytics Matrix"
            >
              <BarChart3 size={18} /> <span>Stats</span>
            </button>
          </div>

          <div className="nav-group">
            <span className="nav-group-label">Production</span>
            <button
              className="toolbar-btn primary"
              onClick={() => {
                const { autoScale } = useFactoryStore.getState();
                autoScale();
              }}
              title="Auto-Scale: Batch set machine counts to match demand"
            >
              <Play size={16} /> <span>Optimize</span>
            </button>

            {focusedNodeId && (
              <button
                className="toolbar-btn danger"
                onClick={() => toggleFocus(null)}
                title="Clear Focus Mode"
              >
                <Target size={16} /> <span>Clear Focus</span>
              </button>
            )}
          </div>

          <div className="nav-group">
            <span className="nav-group-label">Settings</span>
            <RateUnitToggle />
          </div>

          <div className="nav-group">
            <span className="nav-group-label">History</span>
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
              title="Save (Ctrl+S)"
            >
              <Save size={16} />
            </button>
          </div>

          <div className="nav-group">
            <span className="nav-group-label">File</span>
            <button
              className="toolbar-btn icon-only"
              onClick={exportToJSON}
              title="Export Layout (.json)"
            >
              <Download size={16} />
            </button>

            <label
              className="toolbar-btn icon-only clickable"
              title="Import Layout (.json)"
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

          <div className="nav-group">
            <span className="nav-group-label">Layout</span>
            <button
              className="toolbar-btn"
              onClick={autoLayout}
              title="Auto-Organize Layout"
            >
              <Wand2 size={16} /> <span>Organize</span>
            </button>

            <button
              className="toolbar-btn danger"
              onClick={() => {
                if (confirm("Delete EVERYTHING?")) {
                  clearFactory();
                }
              }}
              title="Clear All Blocks"
            >
              <Trash2 size={16} /> <span>Clear All</span>
            </button>
          </div>
        </nav>
        <button
          className={`toolbar-btn ${iconMapperOpen ? "primary" : ""}`}
          onClick={() => setIconMapperOpen(true)}
          title="Calibration: Icon Mapper"
        >
          <Settings size={18} />
        </button>
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
