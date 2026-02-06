/**
 * ROLE: UI Component (Block Footer)
 * PURPOSE: Renders efficiency bar, actual/capacity rates, and power consumption.
 * RELATION: Child of BlockCard.
 */

import { memo } from "react";
import { formatRate, getBarColor } from "./blockHelpers";

interface Props {
  efficiency: number;
  actualRate: number;
  targetRate: number;
  powerMW: number;
  isPerMinute: boolean;
  hasMainOutput: boolean;
}

export const BlockFooter = memo(
  ({
    efficiency,
    actualRate,
    targetRate,
    powerMW,
    isPerMinute,
    hasMainOutput,
  }: Props) => {
    return (
      <div className="block-footer">
        <div
          className="efficiency-bar"
          style={{
            background: `linear-gradient(to right, ${getBarColor(efficiency)} ${
              efficiency * 100
            }%, transparent ${efficiency * 100}%)`,
          }}
        />
        <span className="efficiency-pct">{(efficiency * 100).toFixed(0)}%</span>

        {hasMainOutput && (
          <span className="footer-rates">
            {formatRate(actualRate, isPerMinute)}/
            {formatRate(targetRate, isPerMinute)}
          </span>
        )}

        {powerMW > 0 && (
          <div className="power-info">
            <span className="power-working">{powerMW.toFixed(1)} MW</span>
          </div>
        )}
      </div>
    );
  }
);
