/**
 * ROLE: UI Component (Logical Visualization)
 * PURPOSE: Renders SVG connections between factory blocks.
 * RELATION: FLOW mode visualization.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useFactoryStore } from "../../factory/factoryStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { useUIStore } from "../uiStore";
import { usePortPositions, getPortOffset } from "../hooks/usePortPositions";
import { useGhostEdgeDrag } from "../hooks/useGhostEdgeDrag";
import { bezier, midpoint, portXY } from "../utils/connectionGeometry";
import { ItemIcon } from "./ItemIcon";
import {
  getConnectionStatus,
  getConnectionLabelData,
  ConnectionLabelData,
} from "./connectionStatusHelpers";
import { hasBeltTiers, getNextBeltTier } from "../../gamedata/beltGroups";

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
  labelData: ConnectionLabelData;
  itemId: string;
  beltId?: string;
  isDimmed: boolean;
  isStarved: boolean;
  isShortfall: boolean;
  isSelected: boolean;
  rate: number;
  version: number;
  onSelect: (id: string) => void;
  onBeltChange: (id: string, newBeltId: string) => void;
  onDelete: (id: string) => void;
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
    labelData,
    itemId,
    beltId,
    isDimmed,
    isStarved,
    isShortfall,
    isSelected,
    rate,
    version,
    onSelect,
    onBeltChange,
    onDelete,
  }: ConnectionPathProps) => {
    const [isHovered, setIsHovered] = useState(false);
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

      // Listen for dynamic port reordering during drag
      const onPortsUpdate = (e: any) => {
        const { blockId, ports } = e.detail;
        if (blockId === sourceBlockId) {
          const newY = getPortOffset(ports, "right", itemId);
          portsRef.current.sourcePortY = newY;
          flush();
        } else if (blockId === targetBlockId) {
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
          // If already selected, cycle belt tier
          if (isSelected && hasBeltTiers(beltId)) {
            const nextBelt = getNextBeltTier(beltId);
            onBeltChange(id, nextBelt);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          stroke={
            isStarved
              ? "var(--flow-error)"
              : isShortfall && !isStarved
              ? "var(--flow-warning)"
              : "var(--flow-success)"
          }
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
              "--flow-duration": `${flowDuration}s`,
            } as any
          }
          data-v={version}
        />
        <g
          ref={labelRef}
          transform={`translate(${mid.x}, ${mid.y})`}
          style={{ opacity: isDimmed ? 0 : 1, pointerEvents: "auto" }}
        >
          <foreignObject
            x="-100"
            y="-40"
            width="200"
            height="80"
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            <div
              className="edge-label-container"
              style={{
                width: "fit-content",
                minWidth: "max-content",
                margin: "0 auto",
                background: "rgba(10, 11, 16, 0.95)",
                border: `1px solid ${
                  isStarved
                    ? "var(--flow-error)"
                    : isShortfall
                    ? "var(--flow-warning)"
                    : "rgba(255,255,255,0.15)"
                }`,
                borderRadius: 8,
                padding: "4px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: isStarved
                  ? "var(--flow-error)"
                  : isShortfall
                  ? "var(--flow-warning)"
                  : "var(--text-main)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                gap: 2,
                pointerEvents: "auto",
                transform: "translateY(10px)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                <ItemIcon itemId={itemId} size={20} />
                <span>
                  {labelData.beltCount}× {labelData.beltTier}
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.9,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {labelData.rateText}
              </div>

              {/* Quick Delete Button */}
              {isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--flow-error)",
                    color: "white",
                    border: "2px solid var(--bg-card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    zIndex: 100,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </foreignObject>
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
      removeConnection,
    } = useFactoryStore();
    const { items } = useGameDataStore();
    const highlightSet = useHighlightSet();
    const { rateUnit } = useUIStore();
    const isPerMin = rateUnit === "per_minute";

    // Ghost edge management via extracted hook
    const { ghostEdge } = useGhostEdgeDrag(clientToWorld, connect, runSolver);

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
              onDelete={removeConnection}
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
    isDimmed,
    isSelected,
    onSelect,
    onDelete,
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
    onDelete: (id: string) => void;
    isPerMin: boolean;
    version: number;
  }) => {
    const { recipes, gatherers } = useGameDataStore();
    const { setBelt } = useFactoryStore();
    const sourcePorts = usePortPositions(source, version);
    const targetPorts = usePortPositions(target, version);

    const sourcePortY = getPortOffset(sourcePorts, "right", conn.itemId);
    const targetPortY = getPortOffset(targetPorts, "left", conn.itemId);

    const targetFlow = target.results?.flows?.[conn.itemId];
    const machineRequired = targetFlow?.capacity ?? 0;
    const planRequired = conn.demand;

    // Use extracted helpers for status and label
    const { isStarved, isShortfall } = getConnectionStatus(
      source,
      target,
      conn,
      recipes,
      gatherers
    );

    const labelData = getConnectionLabelData(
      conn,
      isPerMin,
      planRequired,
      machineRequired
    );

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
        labelData={labelData}
        itemId={conn.itemId}
        beltId={conn.beltId}
        isDimmed={isDimmed}
        isStarved={isStarved}
        isShortfall={isShortfall}
        isSelected={isSelected}
        onSelect={onSelect}
        onBeltChange={setBelt}
        onDelete={onDelete}
        rate={conn.rate}
        version={version}
      />
    );
  }
);
