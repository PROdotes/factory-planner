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
  RefreshCw,
  Target,
  Settings,
} from "lucide-react";
import { useFactoryStore } from "./factory/factoryStore";
import { ForgeList } from "./canvas/shell/ForgeList";
import { BalanceTable } from "./canvas/shell/BalanceTable";
import { BottleneckAlerts } from "./canvas/shell/BottleneckAlerts";
import { RateUnitToggle } from "./canvas/components/RateUnitToggle";
import { ImplicitSearchPicker } from "./canvas/blocks/ImplicitSearchPicker";
import { IconMapper } from "./canvas/shell/IconMapper";
import { PowerSummary } from "./canvas/PowerSummary";

export function App() {
  const { loadData, isLoaded, error } = useGameDataStore();
  const { runSolver, loadDemo } = useFactoryStore();
  const {
    leftSidebarOpen,
    toggleLeftSidebar,
    rightSidebarOpen,
    toggleRightSidebar,
    focusedNodeId,
    toggleFocus,
    autoSolveEnabled,
    toggleAutoSolve,
    iconMapperOpen,
    setIconMapperOpen,
  } = useUIStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  // [Solver Watcher] - Ensure rates update when modes change
  useEffect(() => {
    if (isLoaded && autoSolveEnabled) {
      runSolver();
    }
  }, [isLoaded, autoSolveEnabled, runSolver]);

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
          <button
            className={`toolbar-btn ${leftSidebarOpen ? "primary" : ""}`}
            onClick={toggleLeftSidebar}
            title="Toggle Forge (Recipe Catalog)"
          >
            <Hammer size={18} />
          </button>
          <button
            className={`toolbar-btn ${rightSidebarOpen ? "primary" : ""}`}
            onClick={toggleRightSidebar}
            title="Toggle Analytics Matrix"
          >
            <BarChart3 size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={runSolver}
            title="Run Solver"
          >
            <RefreshCw size={16} /> <span>Solve Rates</span>
          </button>

          <button
            className={`toolbar-btn ${autoSolveEnabled ? "primary" : ""}`}
            onClick={() => {
              toggleAutoSolve();
              runSolver();
            }}
            title={
              autoSolveEnabled
                ? "Auto-Pilot: Solver writes values"
                : "Advisory: Manual control"
            }
          >
            <Play size={16} />{" "}
            <span>{autoSolveEnabled ? "Auto" : "Manual"}</span>
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

          <div className="nav-divider" />
          <RateUnitToggle />
          <div className="nav-divider" />

          <button className="toolbar-btn" onClick={loadDemo}>
            <Play size={16} /> <span>Load Test Site</span>
          </button>

          <button
            className={`toolbar-btn ${iconMapperOpen ? "primary" : ""}`}
            onClick={() => setIconMapperOpen(true)}
            title="Calibration: Icon Mapper"
          >
            <Settings size={18} />
          </button>
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
