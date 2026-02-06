/**
 * ROLE: UI Component (Analytics)
 * PURPOSE: Displays aggregated power usage and building counts for the factory.
 */

import { useMemo, useState } from "react";
import { useFactoryStore } from "../factory/factoryStore";
import { useGameDataStore } from "../gamedata/gamedataStore";
import { computeFactoryAnalytics } from "../solver/factoryAnalytics";
import { Zap, ChevronDown, ChevronRight, Building } from "lucide-react";
import { Machine } from "../gamedata/gamedata.types";
import "./PowerSummary.css";
import { useUIStore } from "./uiStore";

function formatPower(watts: number): string {
  if (watts >= 1e9) return `${(watts / 1e9).toFixed(2)} GW`;
  if (watts >= 1e6) return `${(watts / 1e6).toFixed(2)} MW`;
  if (watts >= 1e3) return `${(watts / 1e3).toFixed(2)} kW`;
  return `${watts.toFixed(0)} W`;
}

export function PowerSummary() {
  const { factory, version } = useFactoryStore();
  const { recipes, machines, items, isLoaded } = useGameDataStore();
  const { windEfficiency, setWindEfficiency } = useUIStore();
  const [expanded, setExpanded] = useState(false);
  const [genExpanded, setGenExpanded] = useState(true);
  const [conExpanded, setConExpanded] = useState(true);

  const analytics = useMemo(() => {
    if (!isLoaded) return null;
    return computeFactoryAnalytics(factory, recipes, machines, windEfficiency);
  }, [factory, version, recipes, machines, isLoaded, windEfficiency]);

  const groups = useMemo(() => {
    if (!analytics) return { generation: [], consumption: [] };

    interface GroupItem {
      machineId: string;
      machine: Machine;
      count: number;
      totalPower: number;
      isGen: boolean;
    }

    const gen: GroupItem[] = [];
    const con: GroupItem[] = [];

    Object.entries(analytics.buildingCounts).forEach(([machineId, count]) => {
      const machine = machines[machineId];
      if (!machine) return;

      let totalPower = count * (machine.consumption || 0);
      let isGen = false;

      if (machine.generation && machine.generation > 0) {
        let g = machine.generation;
        if (machine.id === "wind-turbine") g *= windEfficiency;
        totalPower = -count * g;
        isGen = true;
      }

      const item: GroupItem = { machineId, machine, count, totalPower, isGen };
      if (isGen) gen.push(item);
      else con.push(item);
    });

    return { generation: gen, consumption: con };
  }, [analytics, machines, windEfficiency]);

  if (
    !analytics ||
    (groups.generation.length === 0 && groups.consumption.length === 0)
  ) {
    return (
      <div className="power-summary empty">
        <div className="power-header">
          <Zap size={16} className="text-dim" />
          <span>No Power Draw</span>
        </div>
      </div>
    );
  }

  const totalGenCount = groups.generation.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const totalConCount = groups.consumption.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="power-summary">
      <div
        className="power-header clickable"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="header-left">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div className="title-group">
            <Zap
              size={16}
              className={`icon-power ${
                analytics.totalActivePower < 0 ? "surplus" : ""
              }`}
            />
            <span
              className={`power-total ${
                analytics.totalActivePower < 0 ? "surplus" : ""
              }`}
            >
              {analytics.totalActivePower < 0
                ? `${formatPower(Math.abs(analytics.totalActivePower))} Surplus`
                : formatPower(analytics.totalActivePower)}
            </span>
          </div>
        </div>
        <div className="header-right">
          <span className="building-count">
            <Building size={12} />
            {totalGenCount + totalConCount}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="power-details">
          <div className="power-global-settings">
            <div className="setting-row">
              <span className="setting-label">
                Wind Utilization: {Math.round(windEfficiency * 100)}%
              </span>
              <input
                type="range"
                min="0.3"
                max="1.6"
                step="0.1"
                value={windEfficiency}
                onChange={(e) => setWindEfficiency(parseFloat(e.target.value))}
                className="slider-accent"
              />
            </div>
          </div>

          <div className="divider" />

          {/* GENERATION GROUP */}
          {groups.generation.length > 0 && (
            <div className="power-group">
              <div
                className="group-header"
                onClick={() => setGenExpanded(!genExpanded)}
              >
                {genExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span className="group-title">
                  Generation ({totalGenCount})
                </span>
              </div>
              {genExpanded &&
                groups.generation.map((item) => (
                  <div key={item.machineId} className="power-row">
                    <div className="machine-info">
                      <span className="count-badge">{item.count}x</span>
                      <span className="machine-name">
                        {items[item.machineId]?.name || item.machineId}
                      </span>
                    </div>
                    <span className="machine-power generation">
                      -{formatPower(Math.abs(item.totalPower))}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* CONSUMPTION GROUP */}
          {groups.consumption.length > 0 && (
            <div className="power-group">
              <div
                className="group-header"
                onClick={() => setConExpanded(!conExpanded)}
              >
                {conExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span className="group-title">
                  Consumption ({totalConCount})
                </span>
              </div>
              {conExpanded &&
                groups.consumption.map((item) => (
                  <div key={item.machineId} className="power-row">
                    <div className="machine-info">
                      <span className="count-badge">{item.count}x</span>
                      <span className="machine-name">
                        {items[item.machineId]?.name || item.machineId}
                      </span>
                    </div>
                    <span className="machine-power">
                      {formatPower(item.totalPower)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="power-footer">
            <span>Idle Draw: {formatPower(analytics.totalIdlePower)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PowerSummary;
