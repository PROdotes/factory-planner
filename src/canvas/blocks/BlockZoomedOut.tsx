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
}

export const BlockZoomedOut = memo(
  ({ mainOutputId, blockType, machineCount }: Props) => {
    return (
      <div className="zoom-out-view">
        <div className="main-icon">
          {mainOutputId ? (
            <ItemIcon itemId={mainOutputId} size={96} />
          ) : (
            <ItemIcon
              itemId={blockType === "sink" ? "storage-container" : "iron-ore"}
              size={48}
            />
          )}
        </div>
        {machineCount > 0 && (
          <div className="machine-badge">×{Math.ceil(machineCount)}</div>
        )}
      </div>
    );
  }
);
