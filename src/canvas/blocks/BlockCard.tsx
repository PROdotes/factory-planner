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
import { GathererBlock } from "../../factory/blocks/GathererBlock";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useDragToMove } from "../hooks/useDragToMove";
import { useFactoryStore } from "../../factory/factoryStore";
import { useUIStore } from "../uiStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { FLOW_CONFIG, getBlockHeight } from "../LayoutConfig";
import { usePortPositions } from "../hooks/usePortPositions";
import { useBlockCommit } from "../hooks/useBlockCommit";
import { isBlockFailing } from "./blockHelpers";
import {
  calculateMachineMetrics,
  calculatePowerMW,
  calculateFooterMetrics,
  formatPowerRate,
} from "./blockCalculations";
import { collectInputItems, collectOutputItems } from "./blockIOCollector";
import { BlockHeader } from "./BlockHeader";
import { BlockFooter } from "./BlockFooter";
import { BlockPorts } from "./BlockPorts";
import { BlockControls } from "./BlockControls";
import { BlockIORows } from "./BlockIORows";
import { BlockZoomedOut } from "./BlockZoomedOut";
import { ItemIcon } from "./ItemIcon";

interface Props {
  block: BlockBase;
  scale: number;
  version: number;
}

export const BlockCard = memo(({ block, scale, version }: Props) => {
  const { recipes, items, machines, gatherers } = useGameDataStore();
  const {
    moveBlock,
    selectBlock,
    selectedBlockId,
    removeBlock,
    updateBlockName,
    setMachine,
  } = useFactoryStore();

  const isSelected = selectedBlockId === block.id;
  const { toggleFocus, rateUnit } = useUIStore();
  const isPerMin = rateUnit === "per_minute";
  const highlightSet = useHighlightSet();
  const isDimmed =
    highlightSet.blocks.size > 0 && !highlightSet.blocks.has(block.id);

  const connectedInputItems = highlightSet.connectedInputs.get(block.id);
  const connectedOutputItems = highlightSet.connectedOutputs.get(block.id);
  const isOutputHighlight = (itemId: string) =>
    (isSelected && highlightSet.outputItems.has(itemId)) ||
    (connectedOutputItems?.has(itemId) ?? false);
  const isInputHighlight = (itemId: string) =>
    connectedInputItems?.has(itemId) ?? false;

  const { position, isDragging, wasDragged, handlers } = useDragToMove(
    block.id,
    block.position.x,
    block.position.y,
    moveBlock,
    scale
  );

  // Live sort during drag
  const ports = usePortPositions(
    block,
    version,
    isDragging ? position : undefined
  );

  // Sync: When ports reorder dynamically, inform the ConnectionLines layer
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("block-ports-update", {
        detail: { blockId: block.id, ports },
      })
    );
  }, [ports, block.id]);

  // Recipe/Gatherer and machine data
  const recipe =
    block instanceof ProductionBlock && block.recipeId
      ? recipes[block.recipeId]
      : null;
  const gatherer =
    block instanceof GathererBlock && block.gathererId
      ? gatherers[block.gathererId]
      : null;
  const machineId =
    (block instanceof ProductionBlock || block instanceof GathererBlock) &&
    block.machineId
      ? block.machineId
      : recipe?.machineId ?? gatherer?.machineId;

  const machine = machineId ? machines[machineId] : null;

  // Calculate metrics using extracted utilities
  const { requiredMachineCount, targetRateUnitValue, isGenerator } =
    calculateMachineMetrics(block, recipe, machine, isPerMin, gatherer);

  const mainOutput = recipe?.outputs[0];

  // Collect I/O items using extracted utilities
  const inputItems = collectInputItems(block, recipe, items, gatherer);
  const outputItems = collectOutputItems(block, recipe, items, gatherer);

  const isZoomedIn = scale >= 0.9;

  const workingPowerMW = calculatePowerMW(machine, requiredMachineCount);

  // Footer metrics
  const {
    actual: footerActual,
    denom: footerDenom,
    capacity: machineCapacity,
    efficiency: footerEfficiency,
  } = calculateFooterMetrics(block, mainOutput, gatherer);

  const isFailing = isBlockFailing(
    block.satisfaction,
    footerActual,
    footerDenom,
    machineCapacity,
    block.type === "logistics",
    block.type === "gatherer"
  );
  const statusClass = isFailing ? "status-error" : "status-ok";

  const rateLabel = isGenerator ? "" : isPerMin ? "/m" : "/s";

  // Commit handlers from extracted hook
  const { commitMachineCount, commitOutputRate, commitYield } =
    block instanceof ProductionBlock || block instanceof GathererBlock
      ? useBlockCommit(block, recipe, machine, isPerMin, gatherer)
      : {
          commitMachineCount: () => {},
          commitOutputRate: () => {},
          commitYield: () => {},
        };

  const commitMachine = (newMachineId: string) => {
    setMachine(block.id, newMachineId);
  };

  const isLogistics = block.type === "logistics";
  const cardHeight = isLogistics
    ? FLOW_CONFIG.JUNCTION_SIZE
    : getBlockHeight(inputItems.length, outputItems.length);
  const cardWidth = isLogistics
    ? FLOW_CONFIG.JUNCTION_SIZE
    : FLOW_CONFIG.BLOCK_WIDTH;

  // Smart Port logic for Junctions
  const handleMouseUp = (_e: React.MouseEvent) => {
    const activeDrag = (window as any).activePortDrag;
    if (!activeDrag) {
      if (!isLogistics) return;
    }

    let side: string = isLogistics ? "Junction" : "left";

    if (activeDrag) {
      if (!isLogistics) {
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
        detail: { blockId: block.id, itemId, side },
      })
    );
  };

  return (
    <div
      className={`block-card ${block.type} ${isDragging ? "dragging" : ""} ${
        isSelected ? "selected" : ""
      } ${isDimmed ? "dimmed" : ""} ${statusClass} ${
        isLogistics ? "junction" : ""
      } ${block.type === "gatherer" ? "gatherer" : ""}`}
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

      {!isSelected && <div className={`selection-ring ${statusClass}`} />}
      {isLogistics ? (
        <div className="junction-core">
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
                mainOutputId={
                  mainOutput?.itemId ?? gatherer?.outputItemId ?? null
                }
                blockType={block.type}
                machineCount={requiredMachineCount}
                sourceYield={block.sourceYield}
                isGatherer={block.type === "gatherer"}
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
                      targetRateUnitValue={targetRateUnitValue}
                      wasDragged={wasDragged}
                      onMachineCountChange={commitMachineCount}
                      onRateChange={commitOutputRate}
                      onYieldChange={commitYield}
                      onMachineChange={commitMachine}
                    />
                  )}
                {block instanceof GathererBlock && machine && gatherer && (
                  <BlockControls
                    block={block}
                    gatherer={gatherer}
                    machine={machine}
                    rateLabel={rateLabel}
                    targetRateUnitValue={targetRateUnitValue}
                    wasDragged={wasDragged}
                    onMachineCountChange={commitMachineCount}
                    onRateChange={commitOutputRate}
                    onYieldChange={commitYield}
                    onMachineChange={commitMachine}
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
            hasMainOutput={!!mainOutput || !!gatherer}
          />
        </>
      )}
    </div>
  );
});
