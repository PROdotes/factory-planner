/**
 * ROLE: UI Component (Block Controls)
 * PURPOSE: Renders machine count, rate, and yield controls with inline editing.
 * RELATION: Child of BlockCard, only shown when zoomed in.
 */

import { memo, useState, useRef, useEffect } from "react";
import { ProductionBlock } from "../../factory/blocks/ProductionBlock";
import { GathererBlock } from "../../factory/blocks/GathererBlock";
import { Recipe, Machine, Gatherer } from "../../gamedata/gamedata.types";
import { ItemIcon } from "./ItemIcon";

interface Props {
  block: ProductionBlock | GathererBlock;
  recipe?: Recipe;
  gatherer?: Gatherer;
  machine: Machine;
  rateLabel: string;
  displayRate?: string;
  targetRateUnitValue: number;
  wasDragged: boolean;
  onMachineCountChange: (count: number) => void;
  onRateChange: (rate: number) => void;
  onYieldChange: (yieldVal: number) => void;
}

export const BlockControls = memo(
  ({
    block,
    recipe,
    gatherer,
    machine,
    rateLabel,
    displayRate,
    targetRateUnitValue,
    wasDragged,
    onMachineCountChange,
    onRateChange,
    onYieldChange,
  }: Props) => {
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
      if (isEditingCount) countInputRef.current?.focus();
      if (isEditingRate) rateInputRef.current?.focus();
      if (isEditingYield) yieldInputRef.current?.focus();
    }, [isEditingCount, isEditingRate, isEditingYield]);

    const isGatherer = block instanceof GathererBlock;

    const currentMachineCount = block.machineCount;

    const handleCountWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      const delta = e.shiftKey ? 10 : 1;
      let next;
      if (e.deltaY < 0) {
        next = Math.ceil(currentMachineCount + 0.001);
        if (next <= currentMachineCount) next += delta;
        else next += delta - 1;
      } else {
        next = Math.floor(currentMachineCount - 0.001);
        if (next >= currentMachineCount) next -= delta;
        else next -= delta - 1;
      }
      onMachineCountChange(Math.max(0, next));
    };

    const handleYieldWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      const delta = e.shiftKey ? 10 : 1;
      const current = block.sourceYield;
      let next;
      if (e.deltaY < 0) {
        next = Math.ceil(current + 0.001);
        if (next <= current) next += delta;
        else next += delta - 1;
      } else {
        next = Math.floor(current - 0.001);
        if (next >= current) next -= delta;
        else next -= delta - 1;
      }
      onYieldChange(Math.max(0, next));
    };

    const handleRateWheel = (e: React.WheelEvent) => {
      if (!recipe && !gatherer) return; // Cannot scroll rate for generators
      e.stopPropagation();
      const delta = e.shiftKey ? 10 : 1;
      const next =
        e.deltaY < 0
          ? targetRateUnitValue + delta
          : targetRateUnitValue - delta;
      onRateChange(Math.max(0, next));
    };

    const isGenerator = !!machine.generation && !recipe;

    const yieldLabel = isGenerator
      ? "POWER"
      : gatherer?.id.includes("pump") || gatherer?.id.includes("extractor")
      ? "YIELD %"
      : "VEINS";

    const yieldTitle = isGenerator
      ? "Power Output (MW)"
      : gatherer?.id.includes("pump") || gatherer?.id.includes("extractor")
      ? "Yield Multiplier (%)"
      : "Veins Count";

    return (
      <div className="controls-row">
        {/* Machine icon */}
        <div className="machine-info" title={machine.id}>
          <ItemIcon itemId={machine.id} size={24} />
        </div>

        {/* 1. Primary Control: Veins for gatherers, Machines for others */}
        {isGatherer ? (
          <div
            className="control-field has-label"
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDragged && !isEditingYield) {
                setEditYield(block.sourceYield.toFixed(1));
                setIsEditingYield(true);
              }
            }}
            onWheel={handleYieldWheel}
            title={yieldTitle}
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
                    onYieldChange(parseFloat(editYield));
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
            <span className="field-label">{yieldLabel}</span>
          </div>
        ) : (
          <div
            className="control-field has-label"
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDragged && !isEditingCount) {
                setEditCount(currentMachineCount.toFixed(1));
                setIsEditingCount(true);
              }
            }}
            onWheel={handleCountWheel}
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
                    onMachineCountChange(parseFloat(editCount));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setIsEditingCount(false);
                  }}
                />
              ) : (
                <span className="control-value">
                  ×{currentMachineCount.toFixed(1)}
                </span>
              )}
            </div>
            <span className="field-label">MACHINES</span>
          </div>
        )}

        {/* 2. Rate Field (always center) */}
        <div
          className="control-field rate-field has-label"
          onClick={(e) => {
            e.stopPropagation();
            if (!wasDragged && !isEditingRate && !isGenerator) {
              setEditRate(targetRateUnitValue.toFixed(1));
              setIsEditingRate(true);
            }
          }}
          onWheel={handleRateWheel}
          title={
            isGenerator
              ? "Total Power Generation"
              : "Target rate (scroll or click)"
          }
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
                  onRateChange(parseFloat(editRate));
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setIsEditingRate(false);
                }}
              />
            ) : (
              <span className="control-value">
                {displayRate
                  ? displayRate
                  : targetRateUnitValue.toFixed(1) + rateLabel}
              </span>
            )}
          </div>
          <span className="field-label">
            {isGenerator ? "GENERATE" : "RATE"}
          </span>
        </div>

        {/* 3. Secondary Control: Machines for gatherers only */}
        {isGatherer && (
          <div
            className="control-field has-label secondary"
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDragged && !isEditingCount) {
                setEditCount(currentMachineCount.toFixed(1));
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
                    onMachineCountChange(parseFloat(editCount));
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="control-value">
                  ×{currentMachineCount.toFixed(1)}
                </span>
              )}
            </div>
            <span className="field-label">MINERS</span>
          </div>
        )}
      </div>
    );
  }
);
