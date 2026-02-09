/**
 * ROLE: UI Component (Block Ports)
 * PURPOSE: Renders side ports for connections and dispatches drag events.
 * RELATION: Child of BlockCard, used by ConnectionLines for edge routing.
 */

import { memo } from "react";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { ItemIcon } from "./ItemIcon";
import { FLOW_CONFIG } from "../LayoutConfig";
import { PortDescriptor } from "../hooks/usePortPositions";

interface Props {
  blockId: string;
  ports: PortDescriptor[];
  isOutputHighlight: (itemId: string) => boolean;
  isInputHighlight: (itemId: string) => boolean;
}

export const BlockPorts = memo(
  ({ blockId, ports, isOutputHighlight, isInputHighlight }: Props) => {
    const { items } = useGameDataStore();

    return (
      <>
        {ports.map((port, i) => {
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
                width: `${FLOW_CONFIG.PORT_RADIUS * 2}px`,
                height: `${FLOW_CONFIG.PORT_RADIUS * 2}px`,
                left:
                  port.side === "left"
                    ? `-${FLOW_CONFIG.PORT_RADIUS}px`
                    : "auto",
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
                      blockId,
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
                      blockId,
                      itemId: port.itemId,
                      side: port.side,
                    },
                  })
                );
              }}
            >
              <ItemIcon
                itemId={port.itemId}
                size={FLOW_CONFIG.PORT_RADIUS * 1.6}
              />
            </div>
          );
        })}
      </>
    );
  }
);
