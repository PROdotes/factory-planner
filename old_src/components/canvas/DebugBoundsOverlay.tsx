import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '@/stores/layoutStore';
import { getCalculatedSize } from '@/types/block';
import { useGameStore } from '@/stores/gameStore';

interface DebugBoundsOverlayProps {
    containerRef?: React.RefObject<HTMLElement | null>;
}

const SVG_STYLE: React.CSSProperties = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none', transform: 'none', transformOrigin: '0 0', zIndex: 9999, overflow: 'visible' };

export const DebugBoundsOverlay: React.FC<DebugBoundsOverlayProps> = React.memo(({ containerRef }) => {
    const show = useLayoutStore(state => (state.viewSettings as any).showDebugBounds as boolean | undefined);

    const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);
    const [rectState, setRectState] = useState<{ nodeRects: any[]; edgeRects: any[]; stats: { nodes: number; edges: number; edgeRects: number } }>({ nodeRects: [], edgeRects: [], stats: { nodes: 0, edges: 0, edgeRects: 0 } });
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!show) {
            setViewportEl(null);
            return;
        }

        let mounted = true;

        const findViewport = (): HTMLElement | null => {
            let viewport: HTMLElement | null = null;
            try {
                if (containerRef && containerRef.current) {
                    viewport = containerRef.current.querySelector('.react-flow__viewport') as HTMLElement | null;
                }
            } catch (e) {
                // ignore
            }
            if (!viewport) {
                viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
            }
            return viewport;
        };

        const first = findViewport();
        if (first) {
            setViewportEl(first);
            return undefined;
        }

        const interval = window.setInterval(() => {
            if (!mounted) return;
            const v = findViewport();
            if (v) {
                setViewportEl(v);
                window.clearInterval(interval);
            }
        }, 120);

        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, [containerRef, show]);

    useEffect(() => {
        if (!show) return;

        const compute = () => {
            try {
                const { nodes, edges, viewSettings } = useLayoutStore.getState();
                const game = useGameStore.getState().game;

                const nodeRectsLocal: any[] = [];
                for (const n of nodes) {
                    try {
                        const size = getCalculatedSize(n.data as any, viewSettings.flowMode, game);
                        nodeRectsLocal.push({ id: n.id, x: n.position.x, y: n.position.y, width: size.width, height: size.height });
                    } catch (e) {
                        nodeRectsLocal.push({ id: n.id, x: n.position.x || 0, y: n.position.y || 0, width: 120, height: 60 });
                    }
                }

                const edgeRectsLocal: any[] = [];
                for (const edge of edges) {
                    const collisionRects = (edge.data as any)?.collisionRects;
                    if (!collisionRects || collisionRects.length === 0) continue;
                    for (const rect of collisionRects) {
                        edgeRectsLocal.push({ edgeId: edge.id, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
                    }
                }

                const stats = { nodes: nodes.length, edges: edges.length, edgeRects: edgeRectsLocal.length };
                setRectState({ nodeRects: nodeRectsLocal, edgeRects: edgeRectsLocal, stats });
            } catch (err) {
                console.warn('DebugBoundsOverlay compute failed', err);
            }
        };

        const schedule = () => {
            if (rafIdRef.current !== null) return;
            rafIdRef.current = window.requestAnimationFrame(() => {
                rafIdRef.current = null;
                compute();
            });
        };

        let prevNodes = useLayoutStore.getState().nodes;
        let prevEdges = useLayoutStore.getState().edges;
        const unsub = useLayoutStore.subscribe((state) => {
            if (state.nodes !== prevNodes || state.edges !== prevEdges) {
                prevNodes = state.nodes;
                prevEdges = state.edges;
                schedule();
            }
        });

        window.addEventListener('debugBounds:recompute', schedule as EventListener);

        schedule();

        return () => {
            if (rafIdRef.current !== null) {
                window.cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            try { unsub(); } catch (e) { }
            window.removeEventListener('debugBounds:recompute', schedule as EventListener);
        };
    }, [viewportEl, show]);

    const computedViewport = useMemo(() => {
        if (viewportEl) return viewportEl;
        if (containerRef && containerRef.current) {
            return containerRef.current.querySelector('.react-flow__viewport') as HTMLElement | null;
        }
        return null;
    }, [viewportEl, containerRef]);

    if (!show || !computedViewport) return null;

    return createPortal(
        <svg className="debug-bounds-overlay-nodes pointer-events-none" width="1" height="1" overflow="visible" style={SVG_STYLE}>
            {rectState.nodeRects.map(n => (
                <rect key={`nb-${n.id}`} x={n.x} y={n.y} width={n.width} height={n.height} fill="rgba(239,68,68,0.06)" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" opacity={0.95} />
            ))}
            {rectState.edgeRects.map((r, i) => (
                <rect key={`eb-${r.edgeId}-${i}`} x={r.x} y={r.y} width={r.width} height={r.height} fill="rgba(244,63,94,0.08)" stroke="#f97316" strokeWidth={1} />
            ))}
            <g transform="translate(8,16)">
                <rect x={-6} y={-12} width={260} height={18} rx={4} fill="rgba(0,0,0,0.5)" />
                <text x={2} y={2} fontSize={12} fill="#fff">{`nodes ${rectState.stats.nodes} | edges ${rectState.stats.edges} | rects ${rectState.stats.edgeRects}`}</text>
            </g>
        </svg>,
        computedViewport
    );
});

export default DebugBoundsOverlay;
