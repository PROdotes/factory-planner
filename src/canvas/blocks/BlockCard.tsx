/**
 * ROLE: UI Component (Block Wrapper)
 * PURPOSE: Orchestrates block rendering, delegates to focused subcomponents.
 * RELATION: Child of PlannerCanvas, composes BlockHeader, BlockControls, etc.
 *
 * DESIGN:
 * - Zoomed out (scale < 0.9): Large icon + machine badge + status border
 * - Zoomed in (scale >= 0.9): Full controls and I/O debugging
 */

import { memo } from "react";
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
  const rateLabel = isPerMin ? "/m" : "/s";

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
    const targetRate = block.machineCount * ratePerMachine;
    requiredMachineCount = ratePerMachine > 0 ? targetRate / ratePerMachine : 0;
    targetRateUnitValue = isPerMin ? targetRate * 60 : targetRate;
  }

  // Collect I/O items
  const inputItems: IOItem[] =
    block.type === "sink"
      ? Object.keys(block.demand).map((id) => ({
          itemId: id,
          name: items[id]?.name || id,
          actual: block.supply[id] || 0,
          target:
            block.results?.flows?.[id]?.capacity ?? (block.demand[id] || 0),
        }))
      : recipe?.inputs.map((i) => ({
          itemId: i.itemId,
          name: items[i.itemId]?.name || i.itemId,
          actual: block.supply[i.itemId] || 0,
          target:
            block.results?.flows?.[i.itemId]?.capacity ??
            (block.demand[i.itemId] || 0),
        })) || [];

  const outputItems: IOItem[] =
    recipe?.outputs.map((o) => ({
      itemId: o.itemId,
      name: items[o.itemId]?.name || o.itemId,
      actual: block.output[o.itemId] || 0,
      target:
        block.results?.flows?.[o.itemId]?.capacity ??
        (block.requested[o.itemId] || 0),
    })) || [];

  const isZoomedIn = scale >= 0.9;

  const workingPowerMW =
    machine && requiredMachineCount > 0
      ? (machine.consumption * requiredMachineCount) / 1000000
      : 0;

  // Footer Rates
  const primaryFlow = mainOutput
    ? block.results?.flows?.[mainOutput.itemId]
    : null;
  const footerActual =
    primaryFlow?.actual ??
    (mainOutput ? block.output[mainOutput.itemId] || 0 : 0);
  const footerCap = primaryFlow?.capacity ?? 0;
  const footerDemand = primaryFlow?.demand ?? 0;

  // FOOTER: Engineering Goal (Demand)
  const footerDenom = footerDemand > 0 ? footerDemand : footerCap;
  const footerEfficiency =
    footerDemand > 0 ? footerActual / footerDenom : block.satisfaction;
  const statusClass = getStatusClass(footerEfficiency);

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
      }
      if (!autoSolveEnabled) {
        setMachineCount(block.id, val);
      }
    }
  };

  const commitOutputRate = (val: number) => {
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
          ["--port-spacing" as string]: `${FLOW_CONFIG.PORT_VERTICAL_SPACING}px`,
          ["--header-height" as string]: `${FLOW_CONFIG.HEADER_HEIGHT}px`,
          ["--controls-height" as string]: `${FLOW_CONFIG.CONTROLS_HEIGHT}px`,
          ["--footer-height" as string]: `${FLOW_CONFIG.FOOTER_HEIGHT}px`,
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
      <BlockPorts
        blockId={block.id}
        ports={ports}
        isOutputHighlight={isOutputHighlight}
        isInputHighlight={isInputHighlight}
      />

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
              recipe &&
              machine &&
              mainOutput && (
                <BlockControls
                  block={block}
                  recipe={recipe}
                  machine={machine}
                  rateLabel={rateLabel}
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
    </div>
  );
});
