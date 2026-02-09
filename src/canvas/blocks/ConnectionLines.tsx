/**
 * ROLE: UI Component (Logical Visualization)
 * PURPOSE: Renders SVG connections between factory blocks.
 * RELATION: FLOW mode visualization.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFactoryStore } from "../../factory/factoryStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useHighlightSet } from "../hooks/useHighlightSet";
import { useUIStore } from "../uiStore";
import { FLOW_CONFIG } from "../LayoutConfig";
import { usePortPositions, getPortOffset } from "../hooks/usePortPositions";
import { useGhostEdgeDrag } from "../hooks/useGhostEdgeDrag";
import { bezier, portXY } from "../utils/connectionGeometry";
import { ItemIcon } from "./ItemIcon";
import { identifySwimlanes } from "../../factory/autoLayout";
import itemColors from "../../gamedata/itemColors.json";
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
  isDone: boolean;
  rate: number;
  version: number;
  onSelect: (id: string) => void;
  onBeltChange: (id: string, newBeltId: string) => void;
  onDelete: (id: string) => void;
  laneOffset: number;
  sourceOffset: number;
  exitOffset: number;
  isLabelLeader?: boolean;
  groupBeltCount?: number;
  staggerIndex?: number;
  anySelected?: boolean;
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
    isDone,
    rate,
    version,
    onSelect,
    onBeltChange,
    onDelete,
    laneOffset,
    sourceOffset,
    exitOffset,
    isLabelLeader = true,
    groupBeltCount,
    staggerIndex = 0,
    anySelected = false,
  }: ConnectionPathProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const pathRef = useRef<SVGPathElement>(null);
    const hitRef = useRef<SVGPathElement>(null);
    const labelRef = useRef<SVGGElement>(null);

    const flowDuration = rate > 0 ? Math.max(0.1, 2 / rate) : 0;
    const itemColor =
      (itemColors as Record<string, string>)[itemId] || "var(--flow-success)";
    const itemGlow = itemColor.startsWith("#")
      ? `${itemColor}80`
      : "var(--flow-success-glow)";

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
      const d = bezier(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        laneOffset,
        sourceOffset,
        exitOffset
      );

      pathRef.current.setAttribute("d", d);
      hitRef.current.setAttribute("d", d);

      // Label anchored at start of belt (p1) with horizontal stagger
      const labelX = p1.x + staggerIndex * 40;
      const labelY = p1.y;

      labelRef.current.setAttribute(
        "transform",
        `translate(${labelX}, ${labelY})`
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
    }, [
      sourcePos.x,
      sourcePos.y,
      targetPos.x,
      targetPos.y,
      laneOffset,
      sourceOffset,
      exitOffset,
    ]);

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
    }, [
      sourceBlockId,
      targetBlockId,
      itemId,
      laneOffset,
      sourceOffset,
      exitOffset,
    ]);

    const { p1, p2 } = getPoints(pos.current);
    // Label anchored at start of belt (p1) with stagger
    const labelX = p1.x + staggerIndex * 40;
    const labelY = p1.y;

    const d = bezier(
      p1.x,
      p1.y,
      p2.x,
      p2.y,
      laneOffset,
      sourceOffset,
      exitOffset
    );

    return (
      <g
        className={`${isDimmed ? "dimmed" : ""} ${isStarved ? "starved" : ""} ${
          isShortfall && !isStarved ? "shortfall" : ""
        } ${isSelected ? "selected" : ""} ${isDone ? "is-done" : ""}`}
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
          } ${isSelected || anySelected ? "selected" : ""} ${
            isDone ? "is-done" : ""
          }`}
          stroke={
            isStarved
              ? "var(--flow-error)"
              : isShortfall && !isStarved
              ? "var(--flow-warning)"
              : itemColor
          }
          strokeWidth="8"
          strokeOpacity={
            isDimmed ? "0.1" : isStarved ? "1.0" : isShortfall ? "0.4" : "0.85"
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
                : `drop-shadow(0 0 5px ${itemGlow})`,
              "--flow-duration": `${flowDuration}s`,
            } as any
          }
          data-v={version}
        />
        <g
          ref={labelRef}
          transform={`translate(${labelX}, ${labelY})`}
          style={{
            opacity: !isLabelLeader || isDimmed || isDone ? 0 : 1,
            pointerEvents:
              !isLabelLeader || isDimmed || isDone ? "none" : "auto",
          }}
        >
          <foreignObject
            x={FLOW_CONFIG.PORT_RADIUS + 10}
            y="-120"
            width="500"
            height="160"
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            <div
              className="edge-label-container"
              style={{
                width: "fit-content",
                minWidth: "max-content",
                margin: "0",
                background: "rgba(10, 11, 16, 0.95)",
                border: `1px solid ${
                  isStarved
                    ? "var(--flow-error)"
                    : isShortfall
                    ? "var(--flow-warning)"
                    : itemColor.startsWith("#")
                    ? `${itemColor}60`
                    : "rgba(255,255,255,0.15)"
                }`,
                borderRadius: 12,
                padding: "8px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: isStarved
                  ? "var(--flow-error)"
                  : isShortfall
                  ? "var(--flow-warning)"
                  : "var(--text-main)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                gap: 4,
                pointerEvents: "auto",
                transform: "translateY(10px)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                <ItemIcon itemId={itemId} size={40} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>
                    {groupBeltCount ?? labelData.beltCount}×{" "}
                    {labelData.beltTier}
                  </span>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      textTransform: "uppercase",
                      opacity: 0.6,
                      background: labelData.beltTier.includes("3")
                        ? "var(--flow-success)"
                        : labelData.beltTier.includes("2")
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.1)",
                      color: labelData.beltTier.includes("1")
                        ? "white"
                        : "black",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      width: "fit-content",
                      fontWeight: 900,
                    }}
                  >
                    {labelData.beltTier} BUS
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "1.2rem",
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
    const factory = useFactoryStore((s) => s.factory);
    const version = useFactoryStore((s) => s.version);
    const connect = useFactoryStore((s) => s.connect);
    const runSolver = useFactoryStore((s) => s.runSolver);
    const selectedConnectionId = useFactoryStore((s) => s.selectedConnectionId);
    const selectConnection = useFactoryStore((s) => s.selectConnection);
    const removeConnection = useFactoryStore((s) => s.removeConnection);
    const { items } = useGameDataStore();
    const highlightSet = useHighlightSet();
    const { rateUnit } = useUIStore();
    const isPerMin = rateUnit === "per_minute";

    // Ghost edge management via extracted hook
    const { ghostEdge } = useGhostEdgeDrag(clientToWorld, connect, runSolver);

    // Memoize the lane calculation to run only when topology changes
    const laneInfo = useMemo(() => {
      const info = new Map<
        string,
        {
          laneOffset: number;
          sourceOffset: number;
          exitOffset: number;
          labelLeaderId: string;
          groupRate: number;
          groupPlan: number;
          groupMachine: number;
          groupBeltCount: number;
          groupBeltId: string;
          staggerIndex: number;
          anySelected: boolean;
        }
      >();
      const groups = new Map<number, any[]>();
      const swimlaneMap = identifySwimlanes(factory);

      // 1. GLOBAL Port Aggregation (Key: SourceBlock + Item + Physical PortY)
      // This ensures that ALL connections leaving the same PORT share one label.
      const portAggregates = new Map<
        string,
        {
          leaderId: string;
          totalRate: number;
          totalPlan: number;
          totalMachine: number;
          totalBeltCount: number;
          maxBeltId: string;
          maxBeltSpeed: number;
          staggerIndex: number;
          anySelected: boolean;
        }
      >();

      // Track how many unique items are leaving each block for staggering
      const blockItemStagger = new Map<string, string[]>();

      // Port metadata derived from connection Status Helpers
      const BELT_SPEEDS: Record<string, number> = {
        "conveyor-belt-mk-i": 6,
        "conveyor-belt-mk-ii": 12,
        "conveyor-belt-mk-iii": 30,
      };

      // Pre-calculate physical port Y and group aggregates
      factory.connections.forEach((c) => {
        const source = factory.blocks.get(c.sourceBlockId);
        if (!source) return;

        const outputOrder = source.outputOrder || [];
        const pIdx = outputOrder.indexOf(c.itemId);
        const portHStart =
          FLOW_CONFIG.HEADER_HEIGHT +
          FLOW_CONFIG.BORDER_WIDTH +
          FLOW_CONFIG.CONTROLS_HEIGHT;
        const portY =
          source.type === "logistics"
            ? FLOW_CONFIG.JUNCTION_SIZE / 2
            : pIdx >= 0
            ? portHStart +
              pIdx * FLOW_CONFIG.PORT_VERTICAL_SPACING +
              FLOW_CONFIG.PORT_VERTICAL_SPACING / 2
            : portHStart;

        const portKey = `${c.sourceBlockId}-${c.itemId}-${portY}`;

        // Aggregation logic
        const target = factory.blocks.get(c.targetBlockId);
        const targetFlow = target?.results?.flows?.[c.itemId];
        const machineReq = targetFlow?.capacity ?? 0;

        const beltSpeed = BELT_SPEEDS[c.beltId || ""] || 6;

        if (!portAggregates.has(portKey)) {
          // Determine stagger index
          if (!blockItemStagger.has(c.sourceBlockId))
            blockItemStagger.set(c.sourceBlockId, []);
          const items = blockItemStagger.get(c.sourceBlockId)!;
          if (!items.includes(c.itemId)) items.push(c.itemId);

          portAggregates.set(portKey, {
            leaderId: c.id,
            totalRate: 0,
            totalPlan: 0,
            totalMachine: 0,
            totalBeltCount: 0,
            maxBeltId: c.beltId || "conveyor-belt-mk-i",
            maxBeltSpeed: 6,
            staggerIndex: items.indexOf(c.itemId),
            anySelected: false,
          });
        }

        const agg = portAggregates.get(portKey)!;
        agg.totalRate += c.rate;
        agg.totalPlan += c.demand;
        agg.totalMachine += machineReq;
        if (beltSpeed > agg.maxBeltSpeed) {
          agg.maxBeltSpeed = beltSpeed;
          agg.maxBeltId = c.beltId || "conveyor-belt-mk-i";
        }
        if (c.id === selectedConnectionId) agg.anySelected = true;
      });

      // Finalize the Physical Trunk requirement for each port
      portAggregates.forEach((agg) => {
        const peakFlow = Math.max(
          agg.totalRate,
          agg.totalPlan,
          agg.totalMachine
        );
        agg.totalBeltCount = Math.ceil(peakFlow / agg.maxBeltSpeed - 0.0001);
      });

      // 2. Identify Swimlanes & target groups (for routing)
      factory.connections.forEach((conn) => {
        const target = factory.blocks.get(conn.targetBlockId);
        if (!target) return;
        const key = Math.round(target.position.x / 100) * 100;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(conn);
      });

      // 3. Pre-calculate "Manifold Transit Y" for vertical crossing
      const manifoldYByGroup = new Map<number, Map<string, number>>();
      groups.forEach((conns, key) => {
        const itemTotalY = new Map<string, number>();
        const itemCount = new Map<string, number>();
        conns.forEach((c) => {
          const source = factory.blocks.get(c.sourceBlockId);
          if (!source) return;
          const pIdx = (source.outputOrder || []).indexOf(c.itemId);
          const portHStart =
            FLOW_CONFIG.HEADER_HEIGHT +
            FLOW_CONFIG.BORDER_WIDTH +
            FLOW_CONFIG.CONTROLS_HEIGHT;
          const portY =
            source.type === "logistics"
              ? FLOW_CONFIG.JUNCTION_SIZE / 2
              : pIdx >= 0
              ? portHStart +
                pIdx * FLOW_CONFIG.PORT_VERTICAL_SPACING +
                FLOW_CONFIG.PORT_VERTICAL_SPACING / 2
              : portHStart;
          itemTotalY.set(
            c.itemId,
            (itemTotalY.get(c.itemId) || 0) + source.position.y + portY
          );
          itemCount.set(c.itemId, (itemCount.get(c.itemId) || 0) + 1);
        });
        const itemAvg = new Map<string, number>();
        itemTotalY.forEach((sum, itemId) => {
          itemAvg.set(itemId, sum / itemCount.get(itemId)!);
        });
        manifoldYByGroup.set(key, itemAvg);
      });

      // 4. Assign vertical bus offsets
      const columnItemOffsets = new Map<string, number>();
      const sourceGroups = new Map<number, any[]>();
      factory.connections.forEach((conn) => {
        const source = factory.blocks.get(conn.sourceBlockId);
        if (source) {
          const key = Math.round(source.position.x);
          if (!sourceGroups.has(key)) sourceGroups.set(key, []);
          sourceGroups.get(key)!.push(conn);
        }
      });
      sourceGroups.forEach((conns, colX) => {
        const itemMinY = new Map<string, number>();
        conns.forEach((c) => {
          const s = factory.blocks.get(c.sourceBlockId);
          if (!s) return;
          const currentMin = itemMinY.get(c.itemId) ?? Infinity;
          if (s.position.y < currentMin) itemMinY.set(c.itemId, s.position.y);
        });
        const sortedItems = Array.from(itemMinY.keys()).sort(
          (a, b) => (itemMinY.get(a) || 0) - (itemMinY.get(b) || 0)
        );
        sortedItems.forEach((itemId, index) => {
          columnItemOffsets.set(
            `${colX}-${itemId}`,
            index * FLOW_CONFIG.PORT_VERTICAL_SPACING
          );
        });
      });

      // 5. Final assignment
      groups.forEach((conns, targetCol) => {
        const itemPriorityScore = new Map<string, number>();
        conns.forEach((c) => {
          const target = factory.blocks.get(c.targetBlockId);
          if (!target) return;
          const portIndex = (target.inputOrder || []).indexOf(c.itemId);
          const safePortIndex = portIndex >= 0 ? portIndex : 99;
          const score = target.position.y + safePortIndex * 0.1;
          const currentScore = itemPriorityScore.get(c.itemId) ?? Infinity;
          if (score < currentScore) itemPriorityScore.set(c.itemId, score);
        });

        const sortedItems = Array.from(itemPriorityScore.keys()).sort(
          (a, b) => itemPriorityScore.get(a)! - itemPriorityScore.get(b)!
        );
        const itemToLane = new Map<string, number>();
        sortedItems.forEach((itemId, idx) => itemToLane.set(itemId, idx));

        const itemAvgY = manifoldYByGroup.get(targetCol)!;

        conns.forEach((c) => {
          const laneIndex = itemToLane.get(c.itemId) ?? 0;
          const source = factory.blocks.get(c.sourceBlockId);
          if (!source) return;

          const laneOffset = -(laneIndex * FLOW_CONFIG.PORT_VERTICAL_SPACING);
          const pIdx = (source.outputOrder || []).indexOf(c.itemId);
          const portHStart =
            FLOW_CONFIG.HEADER_HEIGHT +
            FLOW_CONFIG.BORDER_WIDTH +
            FLOW_CONFIG.CONTROLS_HEIGHT;
          const portY =
            source.type === "logistics"
              ? FLOW_CONFIG.JUNCTION_SIZE / 2
              : pIdx >= 0
              ? portHStart +
                pIdx * FLOW_CONFIG.PORT_VERTICAL_SPACING +
                FLOW_CONFIG.PORT_VERTICAL_SPACING / 2
              : portHStart;

          const sourceAbsY = source.position.y + portY;
          const rS = Math.round(source.position.x / 100);
          const slId = swimlaneMap.get(source.id) || "misc";
          const groupKey = `${c.itemId}-${slId}`;
          const beltKey = `belt-${rS + 1}-${groupKey}`;
          const physical = factory.layoutMetadata?.beltYPositions.get(beltKey);

          const safeCorridorY = factory.layoutMetadata?.safeCorridors?.get(
            c.id
          );
          const transitY =
            safeCorridorY !== undefined
              ? safeCorridorY
              : physical !== undefined
              ? physical.y + physical.h / 2
              : itemAvgY.get(c.itemId) ?? sourceAbsY;

          const sourceOffset =
            source.type === "logistics" ? 0 : transitY - sourceAbsY;
          const colX = Math.round(source.position.x);
          const exitOffset = columnItemOffsets.get(`${colX}-${c.itemId}`) ?? 0;

          const portKey = `${c.sourceBlockId}-${c.itemId}-${portY}`;
          const aggValue = portAggregates.get(portKey)!;

          info.set(c.id, {
            laneOffset,
            sourceOffset,
            exitOffset,
            labelLeaderId: aggValue.leaderId,
            groupRate: aggValue.totalRate,
            groupPlan: aggValue.totalPlan,
            groupMachine: aggValue.totalMachine,
            groupBeltCount: aggValue.totalBeltCount,
            groupBeltId: aggValue.maxBeltId,
            staggerIndex: aggValue.staggerIndex,
            anySelected: aggValue.anySelected,
          });
        });
      });
      return info;
    }, [
      factory.connections,
      factory.blocks,
      factory.layoutMetadata,
      version,
      isPerMin,
    ]);

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
              isFocusActive={highlightSet.blocks.size > 0}
              isSelected={conn.id === selectedConnectionId}
              onSelect={selectConnection}
              onDelete={removeConnection}
              isPerMin={isPerMin}
              version={version}
              laneOffset={laneInfo.get(conn.id)?.laneOffset ?? 0}
              sourceOffset={laneInfo.get(conn.id)?.sourceOffset ?? 0}
              exitOffset={laneInfo.get(conn.id)?.exitOffset ?? 0}
              labelLeaderId={laneInfo.get(conn.id)?.labelLeaderId}
              groupRate={laneInfo.get(conn.id)?.groupRate}
              groupPlan={laneInfo.get(conn.id)?.groupPlan}
              groupMachine={laneInfo.get(conn.id)?.groupMachine}
              groupBeltCount={laneInfo.get(conn.id)?.groupBeltCount}
              groupBeltId={laneInfo.get(conn.id)?.groupBeltId}
              staggerIndex={laneInfo.get(conn.id)?.staggerIndex ?? 0}
              anySelected={laneInfo.get(conn.id)?.anySelected ?? false}
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
    isFocusActive,
    version,
    laneOffset,
    sourceOffset,
    exitOffset,
    labelLeaderId,
    groupRate,
    groupPlan,
    groupMachine,
    groupBeltCount,
    groupBeltId,
    staggerIndex,
    anySelected,
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
    isFocusActive: boolean;
    version: number;
    laneOffset: number;
    sourceOffset: number;
    exitOffset: number;
    labelLeaderId?: string;
    groupRate?: number;
    groupPlan?: number;
    groupMachine?: number;
    groupBeltCount?: number;
    groupBeltId?: string;
    staggerIndex: number;
    anySelected: boolean;
  }) => {
    const { recipes, gatherers } = useGameDataStore();
    const { setBelt } = useFactoryStore();
    const sourcePorts = usePortPositions(source, version);
    const targetPorts = usePortPositions(target, version);

    const sourcePortY = getPortOffset(sourcePorts, "right", conn.itemId);
    const targetPortY = getPortOffset(targetPorts, "left", conn.itemId);

    // Use aggregated metrics if available for the label
    const labelData = getConnectionLabelData(
      {
        ...conn,
        rate: groupRate ?? conn.rate,
        beltId: groupBeltId ?? conn.beltId,
      },
      isPerMin,
      groupPlan ?? conn.demand,
      groupMachine ?? 0
    );

    const { isStarved, isShortfall } = getConnectionStatus(
      source,
      target,
      conn,
      recipes,
      gatherers
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
        isDone={(!isFocusActive || isDimmed) && source.done && target.done}
        onSelect={onSelect}
        onBeltChange={setBelt}
        onDelete={onDelete}
        rate={conn.rate}
        version={version}
        laneOffset={laneOffset}
        sourceOffset={sourceOffset}
        exitOffset={exitOffset}
        isLabelLeader={labelLeaderId === conn.id}
        groupBeltCount={groupBeltCount}
        staggerIndex={staggerIndex}
        anySelected={anySelected}
      />
    );
  }
);
