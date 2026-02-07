/**
 * ROLE: UI Component (Block Zoomed Out View)
 * PURPOSE: Renders large icon and machine badge for quick identification at low zoom.
 * RELATION: Child of BlockCard, shown when scale < 0.9.
 */

import { memo } from "react";
import { ItemIcon } from "./ItemIcon";

interface Props {
  mainOutputId: string | null;
  blockType: string;
  machineCount: number;
  sourceYield?: number;
  isGatherer?: boolean;
}

export const BlockZoomedOut = memo(
  ({
    mainOutputId,
    blockType,
    machineCount,
    sourceYield,
    isGatherer,
  }: Props) => {
    const displayValue = isGatherer ? sourceYield ?? 0 : machineCount;

    return (
      <div className="zoom-out-view">
        <div className="main-icon">
          {mainOutputId ? (
            <ItemIcon itemId={mainOutputId} size={64} />
          ) : (
            <ItemIcon
              itemId={blockType === "sink" ? "storage-container" : "iron-ore"}
              size={48}
            />
          )}
        </div>
        {displayValue > 0 && (
          <div className="machine-badge">{`×${Math.ceil(displayValue)}`}</div>
        )}
      </div>
    );
  }
);
