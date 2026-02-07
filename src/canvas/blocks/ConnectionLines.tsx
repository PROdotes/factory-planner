/**
 * ROLE: UI Component (Logical Visualization)
 * PURPOSE: Renders SVG connections between factory blocks.
 * RELATION: FLOW mode visualization.
 */

import { memo, useState, useEffect, useRef } from "react";
import { useFactoryStore } from "../../factory/factoryStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { useUIStore } from "../uiStore";
import { FLOW_CONFIG } from "../LayoutConfig";
import { usePortPositions, getPortOffset } from "../hooks/usePortPositions";

// --- Geometry helpers ---

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  return `M ${x1} ${y1} C ${x1 + dx * 0.4} ${y1}, ${
    x2 - dx * 0.4
  } ${y2}, ${x2} ${y2}`;
}

function midpoint(x1: number, y1: number, x2: number, y2: number) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 15 };
}

// --- Absolute port position from block position + port Y offset ---

function portXY(
  blockX: number,
  blockY: number,
  side: "left" | "right",
  portY: number,
  type?: string
) {
  const width =
    type === "logistics" ? FLOW_CONFIG.JUNCTION_SIZE : FLOW_CONFIG.BLOCK_WIDTH;
  return {
    x: side === "left" ? blockX : blockX + width,
    y: blockY + portY,
  };
}

// --- ConnectionPath: draws a single bezier between two absolute points ---

interface ConnectionPathProps {
  id: string;
  sourceBlockId: string;
  sourceBlockType: string;
  targetBlockId: string;
  targetBlockType: string;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  sourcePortY: number;
  targetPortY: number;
  label: string;
  itemId: string;
  isDimmed: boolean;
  isStarved: boolean;
  isShortfall: boolean;
  isSelected: boolean;
  rate: number;
  version: number;
  onSelect: (id: string) => void;
}

const ConnectionPath = memo(
  ({
    id,
    sourceBlockId,
    sourceBlockType,
    targetBlockId,
    targetBlockType,
    sourcePos,
    targetPos,
    sourcePortY,
    targetPortY,
    label,
    itemId,
    isDimmed,
    isStarved,
    isShortfall,
    isSelected,
    rate,
    version,
    onSelect,
  }: ConnectionPathProps) => {
    const pathRef = useRef<SVGPathElement>(null);
    const hitRef = useRef<SVGPathElement>(null);
    const labelRef = useRef<SVGGElement>(null);

    const flowDuration = rate > 0 ? Math.max(0.1, 2 / rate) : 0;

    // Ref for port offsets to escape closure staleness in transient events
    const portsRef = useRef({ sourcePortY, targetPortY });
    portsRef.current = { sourcePortY, targetPortY };

    // pos ref stores the BLOCK positions
    const pos = useRef({
      bx1: sourcePos.x,
      by1: sourcePos.y,
      bx2: targetPos.x,
      by2: targetPos.y,
    });

    // Helper to get raw SVG line points from block positions + offsets
    const getPoints = (p: {
      bx1: number;
      by1: number;
      bx2: number;
      by2: number;
    }) => ({
      p1: portXY(
        p.bx1,
        p.by1,
        "right",
        portsRef.current.sourcePortY,
        sourceBlockType
      ),
      p2: portXY(
        p.bx2,
        p.by2,
        "left",
        portsRef.current.targetPortY,
        targetBlockType
      ),
    });

    const flush = () => {
      if (!pathRef.current || !labelRef.current || !hitRef.current) return;
      const { p1, p2 } = getPoints(pos.current);
      const d = bezier(p1.x, p1.y, p2.x, p2.y);

      pathRef.current.setAttribute("d", d);
      hitRef.current.setAttribute("d", d);
      const mid = midpoint(p1.x, p1.y, p2.x, p2.y);
      labelRef.current.setAttribute(
        "transform",
        `translate(${mid.x}, ${mid.y})`
      );
    };

    // React-level sync (after store commit)
    useEffect(() => {
      pos.current = {
        bx1: sourcePos.x,
        by1: sourcePos.y,
        bx2: targetPos.x,
        by2: targetPos.y,
      };
      flush();
    }, [sourcePos.x, sourcePos.y, targetPos.x, targetPos.y]);

    // Transient-level sync (during drag)
    useEffect(() => {
      const onMove = (e: any) => {
        const { id, x, y } = e.detail;
        if (id === sourceBlockId) {
          pos.current.bx1 = x;
          pos.current.by1 = y;
          flush();
        } else if (id === targetBlockId) {
          pos.current.bx2 = x;
          pos.current.by2 = y;
          flush();
        }
      };

      // NEW: Listen for dynamic port reordering during drag
      const onPortsUpdate = (e: any) => {
        const { blockId, ports } = e.detail;
        if (blockId === sourceBlockId) {
          // Find new Y offset for our source item
          const newY = getPortOffset(ports, "right", itemId);
          portsRef.current.sourcePortY = newY;
          flush();
        } else if (blockId === targetBlockId) {
          // Find new Y offset for our target item
          const newY = getPortOffset(ports, "left", itemId);
          portsRef.current.targetPortY = newY;
          flush();
        }
      };

      window.addEventListener("block-transient-move", onMove);
      window.addEventListener("block-ports-update", onPortsUpdate);
      return () => {
        window.removeEventListener("block-transient-move", onMove);
        window.removeEventListener("block-ports-update", onPortsUpdate);
      };
    }, [sourceBlockId, targetBlockId, itemId]);

    const { p1, p2 } = getPoints(pos.current);
    const mid = midpoint(p1.x, p1.y, p2.x, p2.y);
    const d = bezier(p1.x, p1.y, p2.x, p2.y);

    return (
      <g
        className={`${isDimmed ? "dimmed" : ""} ${isStarved ? "starved" : ""} ${
          isShortfall && !isStarved ? "shortfall" : ""
        } ${isSelected ? "selected" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        style={{ pointerEvents: "auto", cursor: "pointer" }}
      >
        <path
          ref={hitRef}
          d={d}
          stroke="transparent"
          strokeWidth="20"
          fill="none"
        />
        <path
          ref={pathRef}
          d={d}
          className={`edge-path ${isDimmed ? "dimmed" : ""} ${
            isStarved ? "starved" : ""
          } ${isShortfall && !isStarved ? "shortfall" : ""} ${
            rate > 0 ? "animating" : ""
          } ${isSelected ? "selected" : ""}`}
          stroke="var(--flow-success)"
          strokeWidth="6"
          strokeOpacity={
            isDimmed ? "0.1" : isStarved ? "1.0" : isShortfall ? "0.4" : "0.6"
          }
          fill="none"
          style={
            {
              filter: isDimmed
                ? "none"
                : isStarved
                ? "drop-shadow(0 0 6px var(--flow-error))"
                : isShortfall
                ? "none"
                : isSelected
                ? "drop-shadow(0 0 10px var(--accent))"
                : "drop-shadow(0 0 5px var(--flow-success-glow))",
              // @ts-ignore
              "--flow-duration": `${flowDuration}s`,
            } as any
          }
          data-v={version}
        />
        <g
          ref={labelRef}
          transform={`translate(${mid.x}, ${mid.y})`}
          style={{ opacity: isDimmed ? 0 : 1, pointerEvents: "none" }}
        >
          <rect
            x="-60"
            y="-10"
            width="120"
            height="20"
            fill="rgba(10, 11, 16, 0.8)"
            rx="4"
          />
          <text
            x="0"
            y="4"
            fill={
              isStarved
                ? "var(--flow-error)"
                : isShortfall
                ? "var(--flow-warning)"
                : "var(--text-main)"
            }
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      </g>
    );
  }
);

// --- ConnectionLines: maps connections to port coordinates and renders them ---

export const ConnectionLines = memo(
  ({
    clientToWorld,
  }: {
    clientToWorld: (x: number, y: number) => { x: number; y: number };
  }) => {
    const {
      factory,
      version,
      connect,
      runSolver,
      selectedConnectionId,
      selectConnection,
    } = useFactoryStore();
    const { items } = useGameDataStore();
    const highlightSet = useHighlightSet();
    const { rateUnit } = useUIStore();
    const isPerMin = rateUnit === "per_minute";

    // --- Ghost edge for drag-to-connect ---
    const [ghostEdge, setGhostEdge] = useState<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    } | null>(null);
    const activeDrag = useRef<any>(null);

    useEffect(() => {
      const onStart = (e: any) => {
        const { x, y, blockId, itemId, side } = e.detail;
        activeDrag.current = { blockId, itemId, side };
        (window as any).activePortDrag = activeDrag.current;

        const start = clientToWorld(x, y);
        setGhostEdge({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

        const onMove = (moveEv: MouseEvent) => {
          const pt = clientToWorld(moveEv.clientX, moveEv.clientY);
          setGhostEdge((prev) =>
            prev ? { ...prev, x2: pt.x, y2: pt.y } : null
          );
        };

        const onUp = (upEv: MouseEvent) => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp as any);

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
        window.addEventListener("mouseup", onUp as any);
      };

      const onEnd = (e: any) => {
        if (!activeDrag.current) {
          console.log("[CONNECTION] Ignoring drop: No active drag.");
          return;
        }
        const src = activeDrag.current;
        const tgt = e.detail;

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

        // HOLISTIC: Bi-Directional Junction Resolve
        let canConnect = false;
        let finalSrcBlockId = src.blockId;
        let finalTgtBlockId = tgt.blockId;

        // CASE 1: Both are Junctions
        if (src.side === "Junction" && tgt.side === "Junction") {
          if (src.itemId !== "unknown") {
            // Src has item, it must be the source
            finalSrcBlockId = src.blockId;
            finalTgtBlockId = tgt.blockId;
            canConnect = true;
          } else if (tgt.itemId !== "unknown") {
            // Tgt has the item, it must be the source
            finalSrcBlockId = tgt.blockId;
            finalTgtBlockId = src.blockId;
            canConnect = true;
          } else {
            // Both unknown - Abort
            console.warn("[CONNECTION] Cannot link two empty junctions.");
          }
        }
        // CASE 2: Dragging FROM a Junction to a machine
        else if (src.side === "Junction") {
          if (tgt.side === "left") {
            // Dragging to an INPUT -> Junction is SOURCE
            finalSrcBlockId = src.blockId;
            finalTgtBlockId = tgt.blockId;
            canConnect = true;
          } else if (tgt.side === "right") {
            // Dragging to an OUTPUT -> Junction is TARGET
            finalSrcBlockId = tgt.blockId;
            finalTgtBlockId = src.blockId;
            canConnect = true;
          }
        }
        // CASE 3: Dragging FROM a machine TO a Junction
        else if (tgt.side === "Junction") {
          if (src.side === "right") {
            // From OUTPUT to Junction -> Junction is TARGET
            finalSrcBlockId = src.blockId;
            finalTgtBlockId = tgt.blockId;
            canConnect = true;
          } else if (src.side === "left") {
            // From INPUT to Junction -> Junction is SOURCE
            finalSrcBlockId = tgt.blockId;
            finalTgtBlockId = src.blockId;
            canConnect = true;
          }
        }
        // CASE 4: Standard Machine-to-Machine
        else if (src.side === "right" && tgt.side === "left") {
          canConnect = true;
        } else if (src.side === "left" && tgt.side === "right") {
          finalSrcBlockId = tgt.blockId;
          finalTgtBlockId = src.blockId;
          canConnect = true;
        }

        if (canConnect) {
          console.log("[CONNECTION] FINAL ACTION:", {
            src: finalSrcBlockId,
            tgt: finalTgtBlockId,
            item: effectiveItemId,
          });
          connect(finalSrcBlockId, finalTgtBlockId, effectiveItemId);
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

      window.addEventListener("port-drag-start", onStart as any);
      window.addEventListener("port-drag-end", onEnd as any);
      return () => {
        window.removeEventListener("port-drag-start", onStart as any);
        window.removeEventListener("port-drag-end", onEnd as any);
      };
    }, [clientToWorld, connect, runSolver]);

    return (
      <svg
        className="edge-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <desc>v{version}</desc>
        {factory.connections.map((conn) => {
          const source = factory.blocks.get(conn.sourceBlockId);
          const target = factory.blocks.get(conn.targetBlockId);
          if (!source || !target) return null;

          const isDimmed =
            highlightSet.blocks.size > 0 &&
            (!highlightSet.blocks.has(conn.sourceBlockId) ||
              !highlightSet.blocks.has(conn.targetBlockId));

          return (
            <ConnectionPathWithPorts
              key={conn.id}
              conn={conn}
              source={source}
              target={target}
              items={items}
              isDimmed={isDimmed}
              isSelected={conn.id === selectedConnectionId}
              onSelect={selectConnection}
              isPerMin={isPerMin}
              version={version}
            />
          );
        })}

        {ghostEdge && (
          <path
            d={`M ${ghostEdge.x1} ${ghostEdge.y1} L ${ghostEdge.x2} ${ghostEdge.y2}`}
            stroke="var(--flow-success)"
            strokeWidth="2"
            strokeDasharray="4 4"
            fill="none"
          />
        )}
      </svg>
    );
  }
);

// Thin wrapper that resolves port positions and passes plain coords down
const ConnectionPathWithPorts = memo(
  ({
    conn,
    source,
    target,
    items,
    isDimmed,
    isSelected,
    onSelect,
    isPerMin,
    version,
  }: {
    conn: any;
    source: any;
    target: any;
    items: any;
    isDimmed: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isPerMin: boolean;
    version: number;
  }) => {
    const sourcePorts = usePortPositions(source, version);
    const targetPorts = usePortPositions(target, version);

    const sourcePortY = getPortOffset(sourcePorts, "right", conn.itemId);
    const targetPortY = getPortOffset(targetPorts, "left", conn.itemId);

    const rateMult = isPerMin ? 60 : 1;
    const rateLabel = isPerMin ? "/m" : "/s";

    const targetFlow = target.results?.flows?.[conn.itemId];
    const machineRequired = targetFlow?.capacity ?? 0;
    const planRequired = conn.demand;

    // We are only 'Starved' (Red) if we provide less than 99% of the Plan
    // OR less than 99% of what the current machines can physically eat.
    const bindingGoal = Math.min(machineRequired, planRequired);
    const isStarved = machineRequired > 0 && conn.rate < bindingGoal * 0.99;

    const isShortfall = !isStarved && conn.rate < planRequired * 0.99;

    const actualStr = (conn.rate * rateMult).toFixed(1);
    const planStr = (planRequired * rateMult).toFixed(1);

    const label =
      planRequired > machineRequired + 0.001
        ? `${
            items[conn.itemId]?.name || conn.itemId
          } (${actualStr} / ${planStr}${rateLabel})`
        : `${
            items[conn.itemId]?.name || conn.itemId
          } (${actualStr}${rateLabel})`;

    return (
      <ConnectionPath
        id={conn.id}
        sourceBlockId={conn.sourceBlockId}
        sourceBlockType={source.type}
        targetBlockId={conn.targetBlockId}
        targetBlockType={target.type}
        sourcePos={source.position}
        targetPos={target.position}
        sourcePortY={sourcePortY}
        targetPortY={targetPortY}
        label={label}
        itemId={conn.itemId}
        isDimmed={isDimmed}
        isStarved={isStarved}
        isShortfall={isShortfall}
        isSelected={isSelected}
        onSelect={onSelect}
        rate={conn.rate}
        version={version}
      />
    );
  }
);
