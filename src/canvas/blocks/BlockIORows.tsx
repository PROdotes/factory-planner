/**
 * ROLE: UI Component (Block I/O Rows)
 * PURPOSE: Renders input/output rows with rates and satisfaction bars.
 * RELATION: Child of BlockCard, only shown when zoomed in.
 */

import { memo } from "react";
import { formatRate, getBarColor } from "./blockHelpers";

export interface IOItem {
  itemId: string;
  name: string;
  actual: number;
  target: number;
}

interface Props {
  inputItems: IOItem[];
  outputItems: IOItem[];
  isPerMinute: boolean;
  isOutputHighlight: (itemId: string) => boolean;
  isInputHighlight: (itemId: string) => boolean;
  inputDoneItems: Record<string, boolean>;
  outputDoneItems: Record<string, boolean>;
}

export const BlockIORows = memo(
  ({
    inputItems,
    outputItems,
    isPerMinute,
    isOutputHighlight,
    isInputHighlight,
    inputDoneItems,
    outputDoneItems,
  }: Props) => {
    return (
      <div className="io-section">
        {/* Outputs First */}
        {outputItems.length > 0 && (
          <div className="io-group outputs">
            {outputItems.map((item) => {
              const sat = item.target > 0 ? item.actual / item.target : 1;
              const isHighlighted = isOutputHighlight(item.itemId);
              const isDone = outputDoneItems[item.itemId] ?? false;
              return (
                <div
                  key={item.itemId}
                  className={`io-row output ${
                    isHighlighted ? "highlighted" : ""
                  } ${isDone ? "is-done" : ""}`}
                  title={item.name}
                >
                  <span className="io-rates">
                    <span>{formatRate(item.actual, isPerMinute)}</span>
                    <span className="rate-sep">/</span>
                    <span className="rate-target">
                      {formatRate(item.target, isPerMinute)}
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
              const isHighlighted = isInputHighlight(item.itemId);
              const isDone = inputDoneItems[item.itemId] ?? false;
              return (
                <div
                  key={item.itemId}
                  className={`io-row ${isHighlighted ? "highlighted" : ""} ${
                    isDone ? "is-done" : ""
                  }`}
                  title={item.name}
                >
                  <span className="io-rates">
                    <span className={sat < 0.999 ? "rate-bad" : ""}>
                      {formatRate(item.actual, isPerMinute)}
                    </span>
                    <span className="rate-sep">/</span>
                    <span className="rate-target">
                      {formatRate(item.target, isPerMinute)}
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
    );
  }
);
