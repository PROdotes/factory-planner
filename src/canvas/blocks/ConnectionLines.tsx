/**
 * ROLE: UI Component (Logical Visualization)
 * PURPOSE: Renders SVG connections between factory blocks.
 * RELATION: FLOW mode visualization.
 */

import { memo, useState, useEffect, useRef } from 'react';
import { useFactoryStore } from "../../factory/factoryStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useHighlightSet } from '../hooks/useHighlightSet';
import { useUIStore } from '../uiStore';
import { FLOW_CONFIG } from "../LayoutConfig";
import { usePortPositions, getPortOffset } from "../hooks/usePortPositions";

// --- Geometry helpers ---

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    return `M ${x1} ${y1} C ${x1 + dx * 0.4} ${y1}, ${x2 - dx * 0.4} ${y2}, ${x2} ${y2}`;
}

function midpoint(x1: number, y1: number, x2: number, y2: number) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 15 };
}

// --- Absolute port position from block position + port Y offset ---

function portXY(blockX: number, blockY: number, side: 'left' | 'right', portY: number) {
    return {
        x: side === 'left' ? blockX : blockX + FLOW_CONFIG.BLOCK_WIDTH,
        y: blockY + portY,
    };
}

// --- ConnectionPath: draws a single bezier between two absolute points ---

interface ConnectionPathProps {
    sourceBlockId: string;
    targetBlockId: string;
    sourcePos: { x: number, y: number };
    targetPos: { x: number, y: number };
    sourcePortY: number;
    targetPortY: number;
    label: string;
    isDimmed: boolean;
}

const ConnectionPath = memo(({
    sourceBlockId, targetBlockId,
    sourcePos, targetPos,
    sourcePortY, targetPortY,
    label, isDimmed,
}: ConnectionPathProps) => {
    const pathRef = useRef<SVGPathElement>(null);
    const labelRef = useRef<SVGGElement>(null);

    // pos ref stores the BLOCK positions
    const pos = useRef({
        bx1: sourcePos.x, by1: sourcePos.y,
        bx2: targetPos.x, by2: targetPos.y
    });

    // Helper to get raw SVG line points from block positions + offsets
    const getPoints = (p: { bx1: number, by1: number, bx2: number, by2: number }) => ({
        p1: portXY(p.bx1, p.by1, 'right', sourcePortY),
        p2: portXY(p.bx2, p.by2, 'left', targetPortY)
    });

    const flush = () => {
        if (!pathRef.current || !labelRef.current) return;
        const { p1, p2 } = getPoints(pos.current);

        pathRef.current.setAttribute('d', bezier(p1.x, p1.y, p2.x, p2.y));
        const mid = midpoint(p1.x, p1.y, p2.x, p2.y);
        labelRef.current.setAttribute('transform', `translate(${mid.x}, ${mid.y})`);
    };

    // React-level sync (after store commit)
    useEffect(() => {
        pos.current = {
            bx1: sourcePos.x, by1: sourcePos.y,
            bx2: targetPos.x, by2: targetPos.y
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
        window.addEventListener('block-transient-move', onMove);
        return () => window.removeEventListener('block-transient-move', onMove);
    }, [sourceBlockId, targetBlockId]);

    const { p1, p2 } = getPoints(pos.current);
    const mid = midpoint(p1.x, p1.y, p2.x, p2.y);

    return (
        <g className={isDimmed ? 'dimmed' : ''}>
            <path
                ref={pathRef}
                d={bezier(p1.x, p1.y, p2.x, p2.y)}
                className={`edge-path ${isDimmed ? 'dimmed' : ''}`}
                stroke="var(--accent)"
                strokeWidth="3"
                strokeOpacity={isDimmed ? "0.1" : "0.6"}
                fill="none"
                markerEnd="url(#arrowhead)"
                style={{ filter: isDimmed ? 'none' : 'drop-shadow(0 0 4px var(--accent-glow))' }}
            />
            <g ref={labelRef} transform={`translate(${mid.x}, ${mid.y})`} style={{ opacity: isDimmed ? 0 : 1 }}>
                <rect x="-60" y="-10" width="120" height="20" fill="rgba(10, 11, 16, 0.8)" rx="4" />
                <text
                    x="0" y="4"
                    fill="var(--text-main)"
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                >
                    {label}
                </text>
            </g>
        </g>
    );
});

// --- ConnectionLines: maps connections to port coordinates and renders them ---

export const ConnectionLines = memo(({ clientToWorld }: { clientToWorld: (x: number, y: number) => { x: number, y: number } }) => {
    const { factory, version, connect, runSolver } = useFactoryStore();
    const { items } = useGameDataStore();
    const highlightSet = useHighlightSet();
    const { rateUnit } = useUIStore();
    const isPerMin = rateUnit === 'per_minute';

    // --- Ghost edge for drag-to-connect ---
    const [ghostEdge, setGhostEdge] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
    const activeDrag = useRef<any>(null);

    useEffect(() => {
        const onStart = (e: any) => {
            const { x, y, blockId, itemId, side } = e.detail;
            activeDrag.current = { blockId, itemId, side };

            const start = clientToWorld(x, y);
            setGhostEdge({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

            const onMove = (moveEv: MouseEvent) => {
                const pt = clientToWorld(moveEv.clientX, moveEv.clientY);
                setGhostEdge(prev => prev ? { ...prev, x2: pt.x, y2: pt.y } : null);
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                setGhostEdge(null);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        };

        const onEnd = (e: any) => {
            if (!activeDrag.current) return;
            const src = activeDrag.current;
            const tgt = e.detail;

            if (src.side === 'right' && tgt.side === 'left') {
                connect(src.blockId, tgt.blockId, src.itemId);
                runSolver();
            } else if (src.side === 'left' && tgt.side === 'right') {
                connect(tgt.blockId, src.blockId, src.itemId);
                runSolver();
            }
            activeDrag.current = null;
        };

        window.addEventListener('port-drag-start', onStart as any);
        window.addEventListener('port-drag-end', onEnd as any);
        return () => {
            window.removeEventListener('port-drag-start', onStart as any);
            window.removeEventListener('port-drag-end', onEnd as any);
        };
    }, [clientToWorld, connect, runSolver]);

    return (
        <svg
            className="edge-layer"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        >
            <desc>v{version}</desc>
            {factory.connections.map((conn) => {
                const source = factory.blocks.get(conn.sourceBlockId);
                const target = factory.blocks.get(conn.targetBlockId);
                if (!source || !target) return null;

                const isDimmed = highlightSet.blocks.size > 0 && (
                    !highlightSet.blocks.has(conn.sourceBlockId) ||
                    !highlightSet.blocks.has(conn.targetBlockId)
                );

                return (
                    <ConnectionPathWithPorts
                        key={conn.id}
                        conn={conn}
                        source={source}
                        target={target}
                        items={items}
                        isDimmed={isDimmed}
                        isPerMin={isPerMin}
                    />
                );
            })}

            {ghostEdge && (
                <path
                    d={`M ${ghostEdge.x1} ${ghostEdge.y1} L ${ghostEdge.x2} ${ghostEdge.y2}`}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    fill="none"
                />
            )}
        </svg>
    );
});

// Thin wrapper that resolves port positions and passes plain coords down
const ConnectionPathWithPorts = memo(({ conn, source, target, items, isDimmed, isPerMin }: {
    conn: any, source: any, target: any, items: any, isDimmed: boolean, isPerMin: boolean
}) => {
    const sourcePorts = usePortPositions(source);
    const targetPorts = usePortPositions(target);

    const sourcePortY = getPortOffset(sourcePorts, 'right', conn.itemId);
    const targetPortY = getPortOffset(targetPorts, 'left', conn.itemId);

    const rateMult = isPerMin ? 60 : 1;
    const rateLabel = isPerMin ? '/m' : '/s';
    const label = `${items[conn.itemId]?.name || conn.itemId} (${(conn.rate * rateMult).toFixed(1)}${rateLabel})`;

    return (
        <ConnectionPath
            sourceBlockId={conn.sourceBlockId}
            targetBlockId={conn.targetBlockId}
            sourcePos={source.position}
            targetPos={target.position}
            sourcePortY={sourcePortY}
            targetPortY={targetPortY}
            label={label}
            isDimmed={isDimmed}
        />
    );
});
