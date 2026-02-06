/**
 * ROLE: UI Component (Block Wrapper)
 * PURPOSE: Renders a factory block with debugging info and side ports.
 * RELATION: Child of PlannerCanvas, visualizes BlockBase subclasses.
 *
 * DESIGN:
 * - Zoomed out (scale < 0.5): Large icon + machine badge + status border
 * - Zoomed in (scale >= 0.5): Full controls and I/O debugging
 */

import { memo, useState, useRef, useEffect } from "react";
import { BlockBase } from "../../factory/core/BlockBase";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useDragToMove } from "../hooks/useDragToMove";
import { useFactoryStore } from "../../factory/factoryStore";
import { useUIStore } from "../uiStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { ItemIcon } from "./ItemIcon";
import { FLOW_CONFIG, getBlockHeight } from "../LayoutConfig";
import { usePortPositions, PortDescriptor } from "../hooks/usePortPositions";
import { Trash2 } from "lucide-react";

// --- Helpers ---

function formatRate(ratePerSecond: number, isPerMinute: boolean): string {
  const val = isPerMinute ? ratePerSecond * 60 : ratePerSecond;
  if (val >= 100) return `${Math.round(val)}`;
  if (val >= 10) return `${val.toFixed(1)}`;
  if (val >= 1) return `${val.toFixed(1)}`;
  return `${val.toFixed(2)}`;
}

function getStatusClass(satisfaction: number): string {
  if (satisfaction >= 0.999) return "status-ok";
  if (satisfaction > 0.001) return "status-warn";
  return "status-error";
}

function getBarColor(satisfaction: number): string {
  if (satisfaction >= 0.999) return "var(--flow-success)";
  if (satisfaction > 0.001) return "var(--flow-warning)";
  return "var(--flow-error)";
}

// --- Main Component ---

interface Props {
  block: BlockBase;
  scale: number;
}

export const BlockCard = memo(({ block, scale }: Props) => {
  const { recipes, items, machines } = useGameDataStore();
  const {
    moveBlock,
    selectBlock,
    selectedBlockId,
    removeBlock,
    updateBlockName,
    setRequest,
    setYield,
    setMachineCount,
    version,
  } = useFactoryStore();

  const isSelected = selectedBlockId === block.id;
  const { toggleFocus, rateUnit, autoSolveEnabled } = useUIStore();
  const isPerMin = rateUnit === "per_minute";
  const rateLabel = isPerMin ? "/m" : "/s";

  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(block.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [isEditingCount, setIsEditingCount] = useState(false);
  const [editCount, setEditCount] = useState("");
  const countInputRef = useRef<HTMLInputElement>(null);

  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editRate, setEditRate] = useState("");
  const rateInputRef = useRef<HTMLInputElement>(null);

  const [isEditingYield, setIsEditingYield] = useState(false);
  const [editYield, setEditYield] = useState("");
  const yieldInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditName(block.name);
  }, [block.name, block.id, version]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
    if (isEditingCount) countInputRef.current?.focus();
    if (isEditingRate) rateInputRef.current?.focus();
    if (isEditingYield) yieldInputRef.current?.focus();
  }, [isEditingName, isEditingCount, isEditingRate, isEditingYield]);

  const highlightSet = useHighlightSet();
  const isDimmed =
    highlightSet.blocks.size > 0 && !highlightSet.blocks.has(block.id);

  // Determine which items to highlight on THIS block
  const connectedInputItems = highlightSet.connectedInputs.get(block.id);
  const isOutputHighlight = (itemId: string) =>
    isSelected && highlightSet.outputItems.has(itemId);
  const isInputHighlight = (itemId: string) =>
    connectedInputItems?.has(itemId) ?? false;

  const { position, isDragging, wasDragged, handlers } = useDragToMove(
    block.id,
    block.position.x,
    block.position.y,
    moveBlock,
    scale
  );

  const ports = usePortPositions(block);

  // Recipe and machine data
  const recipe =
    block instanceof ProductionBlock && block.recipeId
      ? recipes[block.recipeId]
      : null;
  const machine = recipe ? machines[recipe.machineId] : null;

  // Calculate required machines
  let requiredMachineCount = 0;
  const mainOutput = recipe?.outputs[0];
  let targetRateUnitValue = 0;

  if (block instanceof ProductionBlock && recipe && machine && mainOutput) {
    const yieldMult =
      recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
    const ratePerMachine =
      ((mainOutput.amount * machine.speed) / recipe.craftingTime) * yieldMult;
    const targetRate =
      block.requested[mainOutput.itemId] ||
      block.output[mainOutput.itemId] ||
      0;
    requiredMachineCount = ratePerMachine > 0 ? targetRate / ratePerMachine : 0;
    targetRateUnitValue = isPerMin ? targetRate * 60 : targetRate;
  }

  // Collect I/O items with their rates
  const inputItems =
    block.type === "sink"
      ? Object.keys(block.demand).map((id) => ({
          itemId: id,
          name: items[id]?.name || id,
          actual: block.supply[id] || 0,
          target: block.demand[id] || 0,
        }))
      : recipe?.inputs.map((i) => ({
          itemId: i.itemId,
          name: items[i.itemId]?.name || i.itemId,
          actual: block.supply[i.itemId] || 0,
          target: block.demand[i.itemId] || 0,
        })) || [];

  const outputItems =
    recipe?.outputs.map((o) => ({
      itemId: o.itemId,
      name: items[o.itemId]?.name || o.itemId,
      actual: block.output[o.itemId] || 0,
      target: block.requested[o.itemId] || 0,
    })) || [];

  const isZoomedIn = scale >= 0.9;
  const statusClass = getStatusClass(block.satisfaction);

  const workingPowerMW =
    machine && requiredMachineCount > 0
      ? (machine.consumption * requiredMachineCount) / 1000000
      : 0;

  // Footer Rates (Actual / Capacity)
  const primaryFlow = mainOutput
    ? block.results?.flows?.[mainOutput.itemId]
    : null;
  const footerActual =
    primaryFlow?.actual ??
    (mainOutput ? block.output[mainOutput.itemId] || 0 : 0);
  const footerCap = primaryFlow?.capacity ?? 0;

  // Commit functions
  const commitMachineCount = (val: number) => {
    if (!isNaN(val) && val > 0) {
      if (recipe && mainOutput && machine) {
        const yieldMult =
          recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
        const ratePerMachine =
          ((mainOutput.amount * machine.speed) / recipe.craftingTime) *
          yieldMult;
        setRequest(block.id, mainOutput.itemId, val * ratePerMachine);
      }
      if (!autoSolveEnabled) {
        setMachineCount(block.id, val);
      }
    }
  };

  const commitOutputRate = (val: number) => {
    if (!isNaN(val) && val > 0 && mainOutput) {
      const perSec = isPerMin ? val / 60 : val;
      if (recipe?.category === "Gathering") {
        // Link Rate -> Veins for miners
        if (machine) {
          const ratePerVein =
            (mainOutput.amount * machine.speed) / recipe.craftingTime;
          if (ratePerVein > 0) {
            setYield(block.id, perSec / ratePerVein);
          }
        }
        setRequest(block.id, mainOutput.itemId, perSec);
      } else if (autoSolveEnabled) {
        setRequest(block.id, mainOutput.itemId, perSec);
      } else if (recipe && machine) {
        const yieldMult =
          recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
        const ratePerMachine =
          ((mainOutput.amount * machine.speed) / recipe.craftingTime) *
          yieldMult;
        if (ratePerMachine > 0) {
          setMachineCount(block.id, perSec / ratePerMachine);
          setRequest(block.id, mainOutput.itemId, perSec);
        }
      }
    }
  };

  const commitYield = (val: number) => {
    if (!isNaN(val) && val >= 0) {
      setYield(block.id, val);
      // Link Veins -> Rate for miners
      if (recipe?.category === "Gathering" && mainOutput && machine) {
        const ratePerVein =
          (mainOutput.amount * machine.speed) / recipe.craftingTime;
        setRequest(block.id, mainOutput.itemId, val * ratePerVein);
      }
    }
  };

  // Calculate card height dynamically from centralized config
  const cardHeight = getBlockHeight(inputItems.length, outputItems.length);

  return (
    <div
      className={`block-card ${block.type} ${isDragging ? "dragging" : ""} ${
        isSelected ? "selected" : ""
      } ${isDimmed ? "dimmed" : ""} ${statusClass}`}
      style={
        {
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: `${FLOW_CONFIG.BLOCK_WIDTH}px`,
          height: `${cardHeight}px`,
          zIndex: isDragging ? 1000 : isSelected ? 500 : 1,
          // --- Rule 13: Standard of Truth (JS -> CSS) ---
          ["--port-spacing" as any]: `${FLOW_CONFIG.PORT_VERTICAL_SPACING}px`,
          ["--header-height" as any]: `${FLOW_CONFIG.HEADER_HEIGHT}px`,
          ["--controls-height" as any]: `${FLOW_CONFIG.CONTROLS_HEIGHT}px`,
          ["--footer-height" as any]: `${FLOW_CONFIG.FOOTER_HEIGHT}px`,
        } as React.CSSProperties
      }
      onMouseDown={handlers.onMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        if (!wasDragged) selectBlock(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggleFocus(block.id);
      }}
    >
      {/* Side Ports */}
      {ports.map((port: PortDescriptor, i: number) => {
        const isHighlighted =
          port.side === "right"
            ? isOutputHighlight(port.itemId)
            : isInputHighlight(port.itemId);
        return (
          <div
            key={`${port.side}-${port.itemId}-${i}`}
            className={`port ${port.side} ${
              isHighlighted ? "highlighted" : ""
            }`}
            style={{
              top: `${port.y}px`,
              left:
                port.side === "left" ? `-${FLOW_CONFIG.PORT_RADIUS}px` : "auto",
              right:
                port.side === "right"
                  ? `-${FLOW_CONFIG.PORT_RADIUS}px`
                  : "auto",
            }}
            title={items[port.itemId]?.name || port.itemId}
            onMouseDown={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("port-drag-start", {
                  detail: {
                    blockId: block.id,
                    itemId: port.itemId,
                    side: port.side,
                    x: e.clientX,
                    y: e.clientY,
                  },
                })
              );
            }}
            onMouseUp={() => {
              window.dispatchEvent(
                new CustomEvent("port-drag-end", {
                  detail: {
                    blockId: block.id,
                    itemId: port.itemId,
                    side: port.side,
                  },
                })
              );
            }}
          >
            <ItemIcon
              itemId={port.itemId}
              size={FLOW_CONFIG.PORT_RADIUS * 1.4}
            />
          </div>
        );
      })}

      {/* Header */}
      <div className="block-header">
        <div className={`status-dot ${statusClass}`} />
        {isEditingName ? (
          <input
            ref={nameInputRef}
            className="name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              setIsEditingName(false);
              updateBlockName(block.id, editName);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="block-name"
            title={block.name}
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDragged) setIsEditingName(true);
            }}
          >
            {block.name}
          </span>
        )}
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            removeBlock(block.id);
          }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="block-body">
        {!isZoomedIn ? (
          /* ===== ZOOMED OUT VIEW ===== */
          <div className="zoom-out-view">
            <div className="main-icon">
              {mainOutput ? (
                <ItemIcon itemId={mainOutput.itemId} size={96} />
              ) : (
                <ItemIcon
                  itemId={
                    block.type === "sink" ? "storage-container" : "iron-ore"
                  }
                  size={48}
                />
              )}
            </div>
            {requiredMachineCount > 0 && (
              <div className="machine-badge">
                ×{Math.ceil(requiredMachineCount)}
              </div>
            )}
          </div>
        ) : (
          /* ===== ZOOMED IN VIEW ===== */
          <div className="zoom-in-view">
            {/* Controls Row: Machine + Count + Rate */}
            {block instanceof ProductionBlock && machine && (
              <div className="controls-row">
                {/* Machine icon + name */}
                <div className="machine-info" title={machine.id}>
                  <ItemIcon itemId={machine.id} size={24} />
                </div>

                {/* 1. The "Physical Limit" (Veins for Miners, Machines for others) */}
                {recipe?.category === "Gathering" ? (
                  /* VEINS FIRST for miners */
                  <div
                    className="control-field has-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wasDragged && !isEditingYield) {
                        setEditYield(block.sourceYield.toFixed(1));
                        setIsEditingYield(true);
                      }
                    }}
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const delta = e.shiftKey ? 10 : 1;
                      const current = block.sourceYield;
                      let next;
                      if (e.deltaY < 0) {
                        // Scroll Up
                        next = Math.ceil(current + 0.001);
                        if (next <= current) next += delta;
                        else next += delta - 1;
                      } else {
                        // Scroll Down
                        next = Math.floor(current - 0.001);
                        if (next >= current) next -= delta;
                        else next -= delta - 1;
                      }
                      commitYield(Math.max(0, next));
                    }}
                    title={
                      recipe.machineId.includes("pump") ||
                      recipe.machineId.includes("extractor")
                        ? "Yield Multiplier (%)"
                        : "Veins Count"
                    }
                  >
                    <div className="field-value-row">
                      {isEditingYield ? (
                        <input
                          ref={yieldInputRef}
                          className="control-input"
                          value={editYield}
                          onChange={(e) => setEditYield(e.target.value)}
                          onBlur={() => {
                            setIsEditingYield(false);
                            commitYield(parseFloat(editYield));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setIsEditingYield(false);
                          }}
                        />
                      ) : (
                        <span className="control-value">
                          ×{block.sourceYield.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span className="field-label">
                      {recipe.machineId.includes("pump") ||
                      recipe.machineId.includes("extractor")
                        ? "YIELD %"
                        : "VEINS"}
                    </span>
                  </div>
                ) : (
                  /* MACHINES FIRST for standard factories */
                  <div
                    className="control-field has-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wasDragged && !isEditingCount) {
                        const currentCount = autoSolveEnabled
                          ? requiredMachineCount
                          : block instanceof ProductionBlock
                          ? block.machineCount
                          : requiredMachineCount;
                        setEditCount(currentCount.toFixed(1));
                        setIsEditingCount(true);
                      }
                    }}
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const currentCount = autoSolveEnabled
                        ? requiredMachineCount
                        : block instanceof ProductionBlock
                        ? block.machineCount
                        : requiredMachineCount;
                      const delta = e.shiftKey ? 10 : 1;
                      let next;
                      if (e.deltaY < 0) {
                        // Scroll Up
                        next = Math.ceil(currentCount + 0.001);
                        if (next <= currentCount) next += delta;
                        else next += delta - 1;
                      } else {
                        // Scroll Down
                        next = Math.floor(currentCount - 0.001);
                        if (next >= currentCount) next -= delta;
                        else next -= delta - 1;
                      }
                      commitMachineCount(Math.max(1, next));
                    }}
                    title="Machine count (scroll or click)"
                  >
                    <div className="field-value-row">
                      {isEditingCount ? (
                        <input
                          ref={countInputRef}
                          className="control-input"
                          value={editCount}
                          onChange={(e) => setEditCount(e.target.value)}
                          onBlur={() => {
                            setIsEditingCount(false);
                            commitMachineCount(parseFloat(editCount));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setIsEditingCount(false);
                          }}
                        />
                      ) : (
                        <span className="control-value">
                          ×
                          {autoSolveEnabled
                            ? requiredMachineCount.toFixed(1)
                            : block instanceof ProductionBlock
                            ? block.machineCount.toFixed(1)
                            : requiredMachineCount.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span className="field-label">MACHINES</span>
                  </div>
                )}

                {/* 2. The Rate Box (Always Center) */}
                <div
                  className="control-field rate-field has-label"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!wasDragged && !isEditingRate) {
                      setEditRate(targetRateUnitValue.toFixed(1));
                      setIsEditingRate(true);
                    }
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const delta = e.shiftKey ? 10 : 1;
                    const current = targetRateUnitValue;
                    const next =
                      e.deltaY < 0 ? current + delta : current - delta;
                    commitOutputRate(Math.max(0, next));
                  }}
                  title="Target rate (scroll or click)"
                >
                  <div className="field-value-row">
                    {isEditingRate ? (
                      <input
                        ref={rateInputRef}
                        className="control-input rate-input"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        onBlur={() => {
                          setIsEditingRate(false);
                          commitOutputRate(parseFloat(editRate));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setIsEditingRate(false);
                        }}
                      />
                    ) : (
                      <span className="control-value">
                        {targetRateUnitValue.toFixed(1)}
                        {rateLabel}
                      </span>
                    )}
                  </div>
                  <span className="field-label">RATE</span>
                </div>

                {/* 3. The Secondary Control (Machines for Miners, hidden for others) */}
                {recipe?.category === "Gathering" && (
                  <div
                    className="control-field has-label secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wasDragged && !isEditingCount) {
                        const currentCount = autoSolveEnabled
                          ? requiredMachineCount
                          : block instanceof ProductionBlock
                          ? block.machineCount
                          : requiredMachineCount;
                        setEditCount(currentCount.toFixed(1));
                        setIsEditingCount(true);
                      }
                    }}
                    title="Machine count (secondary for miners)"
                  >
                    <div className="field-value-row">
                      {isEditingCount ? (
                        <input
                          ref={countInputRef}
                          className="control-input"
                          value={editCount}
                          onChange={(e) => setEditCount(e.target.value)}
                          onBlur={() => {
                            setIsEditingCount(false);
                            commitMachineCount(parseFloat(editCount));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="control-value">
                          ×
                          {autoSolveEnabled
                            ? requiredMachineCount.toFixed(1)
                            : (block as ProductionBlock).machineCount}
                        </span>
                      )}
                    </div>
                    <span className="field-label">MINERS</span>
                  </div>
                )}
              </div>
            )}

            {/* I/O Section */}
            <div className="io-section">
              {/* Outputs First */}
              {outputItems.length > 0 && (
                <div className="io-group outputs">
                  {outputItems.map((item) => {
                    const sat = item.target > 0 ? item.actual / item.target : 1;
                    const isItemHighlighted = isOutputHighlight(item.itemId);
                    return (
                      <div
                        key={item.itemId}
                        className={`io-row output ${
                          isItemHighlighted ? "highlighted" : ""
                        }`}
                        title={item.name}
                      >
                        <span className="io-rates">
                          <span>{formatRate(item.actual, isPerMin)}</span>
                          <span className="rate-sep">/</span>
                          <span className="rate-target">
                            {formatRate(item.target, isPerMin)}
                          </span>
                        </span>
                        <div className="io-bar">
                          <div
                            className="io-bar-fill"
                            style={{
                              width: `${Math.min(100, sat * 100)}%`,
                              backgroundColor: getBarColor(sat),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inputs Second */}
              {inputItems.length > 0 && (
                <div className="io-group inputs">
                  {inputItems.map((item) => {
                    const sat = item.target > 0 ? item.actual / item.target : 1;
                    const isItemHighlighted = isInputHighlight(item.itemId);
                    return (
                      <div
                        key={item.itemId}
                        className={`io-row ${
                          isItemHighlighted ? "highlighted" : ""
                        }`}
                        title={item.name}
                      >
                        <span className="io-rates">
                          <span className={sat < 0.999 ? "rate-bad" : ""}>
                            {formatRate(item.actual, isPerMin)}
                          </span>
                          <span className="rate-sep">/</span>
                          <span className="rate-target">
                            {formatRate(item.target, isPerMin)}
                          </span>
                        </span>
                        <div className="io-bar">
                          <div
                            className="io-bar-fill"
                            style={{
                              width: `${Math.min(100, sat * 100)}%`,
                              backgroundColor: getBarColor(sat),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="block-footer">
        <div
          className="efficiency-bar"
          style={{
            background: `linear-gradient(to right, ${getBarColor(
              block.satisfaction
            )} ${block.satisfaction * 100}%, transparent ${
              block.satisfaction * 100
            }%)`,
          }}
        />
        <span className="efficiency-pct">
          {(block.satisfaction * 100).toFixed(0)}%
        </span>

        {mainOutput && (
          <span className="footer-rates">
            {formatRate(footerActual, isPerMin)}/
            {formatRate(footerCap, isPerMin)}
          </span>
        )}

        {workingPowerMW > 0 && (
          <div className="power-info">
            <span className="power-working">
              {workingPowerMW.toFixed(1)} MW
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
