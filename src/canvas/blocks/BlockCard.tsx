/**
 * ROLE: UI Component (Block Wrapper)
 * PURPOSE: Orchestrates block rendering, delegates to focused subcomponents.
 * RELATION: Child of PlannerCanvas, composes BlockHeader, BlockControls, etc.
 *
 * DESIGN:
 * - Zoomed out (scale < 0.9): Large icon + machine badge + status border
 * - Zoomed in (scale >= 0.9): Full controls and I/O debugging
 */

import { memo, useEffect } from "react";
import { BlockBase } from "../../factory/core/BlockBase";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useDragToMove } from "../hooks/useDragToMove";
import { useFactoryStore } from "../../factory/factoryStore";
import { useUIStore } from "../uiStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { FLOW_CONFIG, getBlockHeight } from "../LayoutConfig";
import { usePortPositions } from "../hooks/usePortPositions";
import { getStatusClass } from "./blockHelpers";
import { BlockHeader } from "./BlockHeader";
import { BlockFooter } from "./BlockFooter";
import { BlockPorts } from "./BlockPorts";
import { BlockControls } from "./BlockControls";
import { BlockIORows, IOItem } from "./BlockIORows";
import { BlockZoomedOut } from "./BlockZoomedOut";
import { ItemIcon } from "./ItemIcon";

interface Props {
  block: BlockBase;
  scale: number;
  version: number;
}

export const BlockCard = memo(({ block, scale, version }: Props) => {
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
  } = useFactoryStore();

  const isSelected = selectedBlockId === block.id;
  const { toggleFocus, rateUnit, autoSolveEnabled } = useUIStore();
  const isPerMin = rateUnit === "per_minute";
  const highlightSet = useHighlightSet();
  const isDimmed =
    highlightSet.blocks.size > 0 && !highlightSet.blocks.has(block.id);

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

  // NEW: Live sort during drag
  // If dragging, we use the TRANSITORY position (from useDragToMove) to calculate port order
  const ports = usePortPositions(
    block,
    version,
    isDragging ? position : undefined
  );

  // Sync: When ports reorder dynamically (drag or neighbor move), we must inform the virtual ConnectionLines layer
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("block-ports-update", {
        detail: {
          blockId: block.id,
          ports,
        },
      })
    );
  }, [ports, block.id]);

  // Recipe and machine data
  const recipe =
    block instanceof ProductionBlock && block.recipeId
      ? recipes[block.recipeId]
      : null;
  const machine = recipe
    ? machines[recipe.machineId]
    : block instanceof ProductionBlock && block.machineId
    ? machines[block.machineId]
    : null;

  // Calculate required machines
  let requiredMachineCount = 0;
  const mainOutput = recipe?.outputs[0];
  let targetRateUnitValue = 0;

  if (block instanceof ProductionBlock && machine) {
    if (recipe && mainOutput) {
      const yieldMult =
        recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
      const ratePerMachine =
        ((mainOutput.amount * machine.speed) / recipe.craftingTime) * yieldMult;
      const targetRate = block.machineCount * ratePerMachine;
      requiredMachineCount =
        ratePerMachine > 0 ? targetRate / ratePerMachine : 0;
      targetRateUnitValue = isPerMin ? targetRate * 60 : targetRate;
    } else if (machine.generation) {
      // It's a generator block
      requiredMachineCount = block.machineCount;
      targetRateUnitValue = block.machineCount * machine.generation;
    }
  }

  const isGenerator =
    block instanceof ProductionBlock &&
    machine &&
    !recipe &&
    !!machine.generation;

  // Collect I/O items
  // Input: actual = supply received, target = min(machineCapacity, demandForFactoryMax)
  // Output: actual = sent, target = min(machineCapacity, factoryMax)
  // Shows "108/360" = "I'm getting 108 but want 360" - machine is starved
  // Footer shows "108/405" = factory utilization (actual vs factory max)
  const inputItems: IOItem[] =
    block.type === "sink"
      ? Object.keys(block.demand).map((id) => {
          return {
            itemId: id,
            name: items[id]?.name || id,
            actual: block.supply[id] || 0,
            target: block.demand[id] || 0,
          };
        })
      : recipe?.inputs.map((i) => {
          const flow = block.results?.flows?.[i.itemId];
          // capacity = what machines can consume at full machineCount
          // block.demand = input needed for factory max (from backward pass)
          const machineCapacity =
            flow?.capacity ?? (block.demand[i.itemId] || 0);
          const demandForFactoryMax = block.demand[i.itemId] || 0;
          const workingTarget = Math.min(machineCapacity, demandForFactoryMax);
          return {
            itemId: i.itemId,
            name: items[i.itemId]?.name || i.itemId,
            actual: block.supply[i.itemId] || 0,
            target: workingTarget,
          };
        }) || [];

  const outputItems: IOItem[] =
    recipe?.outputs.map((o) => {
      const flow = block.results?.flows?.[o.itemId];
      const factoryMax = flow?.demand ?? (block.output[o.itemId] || 0);
      const machineCapacity = flow?.capacity ?? factoryMax;
      const workingTarget = Math.min(machineCapacity, factoryMax);
      return {
        itemId: o.itemId,
        name: items[o.itemId]?.name || o.itemId,
        actual: flow?.sent ?? (block.output[o.itemId] || 0),
        target: workingTarget,
      };
    }) || [];

  const isZoomedIn = scale >= 0.9;

  const workingPowerMW =
    machine && requiredMachineCount > 0
      ? (machine.consumption * requiredMachineCount) / 1000000
      : 0;

  // Footer Rates
  const primaryFlow = mainOutput
    ? block.results?.flows?.[mainOutput.itemId]
    : null;
  // sent = what actually left the block (gated by downstream)
  // demand = factory max (total downstream capacity)
  const footerActual = primaryFlow?.sent ?? 0;
  const footerDenom = primaryFlow?.demand ?? 0; // Factory max, NOT actual production

  const footerEfficiency =
    footerDenom > 0 ? footerActual / footerDenom : block.satisfaction;
  const statusClass = getStatusClass(footerEfficiency);

  const rateLabel = isGenerator ? "" : isPerMin ? "/m" : "/s";

  // Helper to format power for the RATE field
  const formatPowerRate = (watts: number) => {
    if (watts >= 1e6) return (watts / 1e6).toFixed(1) + "MW";
    if (watts >= 1e3) return (watts / 1e3).toFixed(1) + "kW";
    return watts.toFixed(0) + "W";
  };

  // Commit functions
  const commitMachineCount = (val: number) => {
    if (!isNaN(val) && val >= 0) {
      if (recipe && mainOutput && machine) {
        const yieldMult =
          recipe.category === "Gathering" ? block.sourceYield ?? 1.0 : 1.0;
        const ratePerMachine =
          ((mainOutput.amount * machine.speed) / recipe.craftingTime) *
          yieldMult;
        setRequest(block.id, mainOutput.itemId, val * ratePerMachine);
      } else if (isGenerator) {
        // For generators, we just set the machine count directly
      }
      if (!autoSolveEnabled) {
        setMachineCount(block.id, val);
      }
    }
  };

  const commitOutputRate = (val: number) => {
    if (isGenerator) return; // Cannot edit rate directly for generators for now

    if (!isNaN(val) && val >= 0 && mainOutput) {
      const perSec = isPerMin ? val / 60 : val;
      if (recipe?.category === "Gathering") {
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
      if (recipe?.category === "Gathering" && mainOutput && machine) {
        const ratePerVein =
          (mainOutput.amount * machine.speed) / recipe.craftingTime;
        setRequest(block.id, mainOutput.itemId, val * ratePerVein);
      }
    }
  };

  const isLogistics = block.type === "logistics";
  const cardHeight = isLogistics
    ? FLOW_CONFIG.JUNCTION_SIZE
    : getBlockHeight(inputItems.length, outputItems.length);
  const cardWidth = isLogistics
    ? FLOW_CONFIG.JUNCTION_SIZE
    : FLOW_CONFIG.BLOCK_WIDTH;

  // Smart Port logic for Junctions: Automatically choose the correct "side" based on the incoming connection
  const handleMouseUp = (e: React.MouseEvent) => {
    // Check if we are currently dragging a port (from ConnectionLines ref effectively)
    // We'll use a custom event to check or just dispatch and let ConnectionLines decide
    const activeDrag = (window as any).activePortDrag;
    if (!activeDrag) {
      if (!isLogistics) return;
    }

    // Logic: If we are landing a wire, we need to pick a side.
    let side: string = isLogistics ? "Junction" : "left"; // Default to input

    if (activeDrag) {
      // Intelligently pick side if not a junction
      if (!isLogistics) {
        // If we dragged an OUTPUT, we land on an INPUT
        if (activeDrag.side === "right" || activeDrag.side === "Junction") {
          side = "left";
        } else {
          side = "right";
        }
      }
    }

    const itemId =
      Object.keys(block.demand).find((k) => k !== "unknown") || "unknown";

    window.dispatchEvent(
      new CustomEvent("port-drag-end", {
        detail: {
          blockId: block.id,
          itemId,
          side,
        },
      })
    );
  };

  return (
    <div
      className={`block-card ${block.type} ${isDragging ? "dragging" : ""} ${
        isSelected ? "selected" : ""
      } ${isDimmed ? "dimmed" : ""} ${statusClass} ${
        isLogistics ? "junction" : ""
      }`}
      style={
        {
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          zIndex: isDragging ? 1000 : isSelected ? 500 : 1,
          ["--port-spacing" as string]: `${FLOW_CONFIG.PORT_VERTICAL_SPACING}px`,
          ["--header-height" as string]: `${FLOW_CONFIG.HEADER_HEIGHT}px`,
          ["--controls-height" as string]: `${FLOW_CONFIG.CONTROLS_HEIGHT}px`,
          ["--footer-height" as string]: `${FLOW_CONFIG.FOOTER_HEIGHT}px`,
        } as React.CSSProperties
      }
      onMouseDown={handlers.onMouseDown}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        e.stopPropagation();
        if (!wasDragged) selectBlock(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggleFocus(block.id);
      }}
    >
      {!isLogistics && (
        <BlockPorts
          blockId={block.id}
          ports={ports}
          isOutputHighlight={isOutputHighlight}
          isInputHighlight={isInputHighlight}
        />
      )}

      {isLogistics ? (
        <div className="junction-core">
          {/* HOLISTIC: The Rim for connection (stops propagation) */}
          <div
            className="junction-rim"
            onMouseDown={(e) => {
              e.stopPropagation();
              const itemId =
                Object.keys(block.demand).find((k) => k !== "unknown") ||
                "unknown";
              window.dispatchEvent(
                new CustomEvent("port-drag-start", {
                  detail: {
                    x: e.clientX,
                    y: e.clientY,
                    blockId: block.id,
                    itemId,
                    side: "Junction",
                  },
                })
              );
            }}
          />

          {/* HOLISTIC: The Move Handle (allows propagation to bubble to BlockCard) */}
          <div className="junction-move-handle">
            <ItemIcon
              itemId={
                ports.find((p) => p.itemId !== "unknown")?.itemId ||
                Object.keys(block.demand).find((k) => k !== "unknown") ||
                ""
              }
              size={24}
            />
          </div>

          {/* Invisible ports centered for routing */}
          <div className="internal-ports" style={{ display: "none" }}>
            <BlockPorts
              blockId={block.id}
              ports={ports}
              isOutputHighlight={isOutputHighlight}
              isInputHighlight={isInputHighlight}
            />
          </div>
        </div>
      ) : (
        <>
          <BlockHeader
            blockId={block.id}
            name={block.name}
            statusClass={statusClass}
            version={version}
            wasDragged={wasDragged}
            onDelete={() => removeBlock(block.id)}
            onNameChange={(name) => updateBlockName(block.id, name)}
          />

          <div className="block-body">
            {!isZoomedIn ? (
              <BlockZoomedOut
                mainOutputId={mainOutput?.itemId ?? null}
                blockType={block.type}
                machineCount={requiredMachineCount}
              />
            ) : (
              <div className="zoom-in-view">
                {block instanceof ProductionBlock &&
                  machine &&
                  (recipe || isGenerator) && (
                    <BlockControls
                      block={block}
                      recipe={recipe || undefined}
                      machine={machine}
                      rateLabel={rateLabel}
                      displayRate={
                        isGenerator
                          ? formatPowerRate(targetRateUnitValue)
                          : undefined
                      }
                      requiredMachineCount={requiredMachineCount}
                      targetRateUnitValue={targetRateUnitValue}
                      autoSolveEnabled={autoSolveEnabled}
                      wasDragged={wasDragged}
                      onMachineCountChange={commitMachineCount}
                      onRateChange={commitOutputRate}
                      onYieldChange={commitYield}
                    />
                  )}

                <BlockIORows
                  inputItems={inputItems}
                  outputItems={outputItems}
                  isPerMinute={isPerMin}
                  isOutputHighlight={isOutputHighlight}
                  isInputHighlight={isInputHighlight}
                />
              </div>
            )}
          </div>

          <BlockFooter
            efficiency={footerEfficiency}
            actualRate={footerActual}
            targetRate={footerDenom}
            powerMW={workingPowerMW}
            isPerMinute={isPerMin}
            hasMainOutput={!!mainOutput}
          />
        </>
      )}
    </div>
  );
});
