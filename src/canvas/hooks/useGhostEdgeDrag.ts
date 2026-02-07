/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Manages the ghost edge during drag-to-connect operations.
 * RELATION: Used by ConnectionLines to handle port drag events.
 */

import { useState, useEffect, useRef } from "react";
import { useUIStore } from "../uiStore";

export interface GhostEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PortDragInfo {
  blockId: string;
  itemId: string;
  side: "left" | "right" | "Junction";
}

/**
 * Hook that manages the ghost edge visualization and connection logic
 * during drag-to-connect operations.
 *
 * Handles:
 * - Ghost edge state and rendering coordinates
 * - port-drag-start and port-drag-end events
 * - Bidirectional junction resolution
 * - Item matching validation
 */
export function useGhostEdgeDrag(
  clientToWorld: (x: number, y: number) => { x: number; y: number },
  connect: (sourceId: string, targetId: string, itemId: string) => void,
  runSolver: () => void
): { ghostEdge: GhostEdge | null } {
  const [ghostEdge, setGhostEdge] = useState<GhostEdge | null>(null);
  const activeDrag = useRef<PortDragInfo | null>(null);

  useEffect(() => {
    const onStart = (e: CustomEvent) => {
      const { x, y, blockId, itemId, side } = e.detail;
      activeDrag.current = { blockId, itemId, side };
      (window as any).activePortDrag = activeDrag.current;

      const start = clientToWorld(x, y);
      setGhostEdge({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

      const onMove = (moveEv: MouseEvent) => {
        const pt = clientToWorld(moveEv.clientX, moveEv.clientY);
        setGhostEdge((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
      };

      const onUp = (upEv: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        // RACE PROTECTION: Delay the cleanup slightly so 'onEnd' can finish
        setTimeout(() => {
          if (activeDrag.current) {
            const pt = clientToWorld(upEv.clientX, upEv.clientY);
            useUIStore.getState().setImplicitSearch({
              ...activeDrag.current,
              worldPos: pt,
              clientPos: { x: upEv.clientX, y: upEv.clientY },
            });
            activeDrag.current = null;
            (window as any).activePortDrag = null;
          }
          setGhostEdge(null);
        }, 10);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const onEnd = (e: CustomEvent) => {
      if (!activeDrag.current) {
        console.log("[CONNECTION] Ignoring drop: No active drag.");
        return;
      }

      const src = activeDrag.current;
      const tgt = e.detail as PortDragInfo;

      console.log("[CONNECTION] Resolving drop:", { src, tgt });

      // Validation: Items must match! (Allow 'unknown' to adopt the other side's item)
      const effectiveItemId =
        src.itemId !== "unknown" ? src.itemId : tgt.itemId;

      if (
        src.itemId !== "unknown" &&
        tgt.itemId !== "unknown" &&
        src.itemId !== tgt.itemId
      ) {
        console.warn(
          `[CONNECTION] ABORT: Mismatched items: ${src.itemId} vs ${tgt.itemId}`
        );
        activeDrag.current = null;
        (window as any).activePortDrag = null;
        return;
      }

      if (effectiveItemId === "unknown") {
        console.warn("[CONNECTION] ABORT: Still unknown item on both sides.");
        activeDrag.current = null;
        (window as any).activePortDrag = null;
        return;
      }

      // Resolve connection direction
      const result = resolveConnectionDirection(src, tgt);

      if (result.canConnect) {
        console.log("[CONNECTION] FINAL ACTION:", {
          src: result.sourceBlockId,
          tgt: result.targetBlockId,
          item: effectiveItemId,
        });
        connect(result.sourceBlockId, result.targetBlockId, effectiveItemId);
        runSolver();
      } else {
        console.warn("[CONNECTION] ABORT: No valid directional role.", {
          srcSide: src.side,
          tgtSide: tgt.side,
        });
      }

      activeDrag.current = null;
      (window as any).activePortDrag = null;
    };

    window.addEventListener("port-drag-start", onStart as EventListener);
    window.addEventListener("port-drag-end", onEnd as EventListener);
    return () => {
      window.removeEventListener("port-drag-start", onStart as EventListener);
      window.removeEventListener("port-drag-end", onEnd as EventListener);
    };
  }, [clientToWorld, connect, runSolver]);

  return { ghostEdge };
}

interface ConnectionResult {
  canConnect: boolean;
  sourceBlockId: string;
  targetBlockId: string;
}

/**
 * Resolves the direction of a connection based on port sides.
 * Handles junction-to-junction, junction-to-machine, and machine-to-machine cases.
 */
function resolveConnectionDirection(
  src: PortDragInfo,
  tgt: PortDragInfo
): ConnectionResult {
  let canConnect = false;
  let sourceBlockId = src.blockId;
  let targetBlockId = tgt.blockId;

  // CASE 1: Both are Junctions
  if (src.side === "Junction" && tgt.side === "Junction") {
    if (src.itemId !== "unknown") {
      // Src has item, it must be the source
      canConnect = true;
    } else if (tgt.itemId !== "unknown") {
      // Tgt has the item, it must be the source
      sourceBlockId = tgt.blockId;
      targetBlockId = src.blockId;
      canConnect = true;
    }
    // Both unknown - cannot connect
  }
  // CASE 2: Dragging FROM a Junction to a machine
  else if (src.side === "Junction") {
    if (tgt.side === "left") {
      // Dragging to an INPUT -> Junction is SOURCE
      canConnect = true;
    } else if (tgt.side === "right") {
      // Dragging to an OUTPUT -> Junction is TARGET
      sourceBlockId = tgt.blockId;
      targetBlockId = src.blockId;
      canConnect = true;
    }
  }
  // CASE 3: Dragging FROM a machine TO a Junction
  else if (tgt.side === "Junction") {
    if (src.side === "right") {
      // From OUTPUT to Junction -> Junction is TARGET
      canConnect = true;
    } else if (src.side === "left") {
      // From INPUT to Junction -> Junction is SOURCE
      sourceBlockId = tgt.blockId;
      targetBlockId = src.blockId;
      canConnect = true;
    }
  }
  // CASE 4: Standard Machine-to-Machine
  else if (src.side === "right" && tgt.side === "left") {
    canConnect = true;
  } else if (src.side === "left" && tgt.side === "right") {
    sourceBlockId = tgt.blockId;
    targetBlockId = src.blockId;
    canConnect = true;
  }

  return { canConnect, sourceBlockId, targetBlockId };
}
