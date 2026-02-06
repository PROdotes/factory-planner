import React, { useMemo } from 'react';
import { Point, getLaneCount } from '@lib/router/channelRouter';
import { BLOCK_FLOW_LAYOUT, getBeltFoundationWidth } from '@/types/block';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';

export interface ChannelRendererProps {
    points: Point[];
    throughput: number;
    beltCapacity?: number;
    color?: string;
    isSelected?: boolean;
    showFlow?: boolean;
    bundleLanes?: boolean;
    pattern?: string;
    isBridge?: boolean;
    status?: string;
    flowMode?: boolean;
}

// Standard mode dimensions
const LANE_WIDTH = LAYOUT_METRICS.belt.standardLaneWidth;
const LANE_SPACING = LAYOUT_METRICS.belt.standardLaneSpacing;

// Flow mode dimensions (Sync with BLOCK_FLOW_LAYOUT)
const FLOW_MODE_LANE_WIDTH = BLOCK_FLOW_LAYOUT.LANE_WIDTH;
const FLOW_MODE_LANE_SPACING = BLOCK_FLOW_LAYOUT.LANE_SPACING;

/**
 * Calculates the offset points for a specific lane index.
 * Uses proper segment offset logic (miter joints) instead of diagonal shift.
 */
function getOffsetPath(points: Point[], offset: number): string {
    if (points.length < 2) return '';

    const offsetPoints: Point[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        // 1. Calculate Segment Normal (Perpendicular)
        // Direction Vector
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;

        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue; // Degenerate segment
        dx /= len;
        dy /= len;

        // Normal Vector (-dy, dx) gives "Left" side offset
        const nx = -dy;
        const ny = dx;

        // 2. Offset the endpoints
        // P1_offset
        const p1_off = { x: p1.x + nx * offset, y: p1.y + ny * offset };
        // P2_offset
        const p2_off = { x: p2.x + nx * offset, y: p2.y + ny * offset };

        // 3. Logic for Corner handling
        // If this is the first segment, just add the start point
        if (i === 0) {
            offsetPoints.push(p1_off);
        } else {
            // We need to Intersect with previous segment? 
            // With strictly Manhattan paths (90 deg turns), the intersection logic is simple:
            // If Direction changed from Horizontal to Vertical, the Corner Point 
            // is simply the intersection of the two infinite offset lines.
            // OR simpler: For Manhattan, the corner logic is actually trivial 
            // if we consider that we are just shifting the "Tube".

            // However, to fix the visual "crossing" artifact, we need to handle the corner Vertex explicitly.
            // The previous segment ended at 'prev_p2_off'. The current starts at 'p1_off'.
            // In a Manhattan 90deg turn, these two points will define the corner.
            // If we just draw L p1_off L p2_off, we might have a gap or overlap with the previous segment.

            // Let's refine:
            // We need ONE point for the corner.
            // It acts as the End of Seg 1 and Start of Seg 2.
            // For Manhattan, this Corner point is (p1.x + corner_offset_x, p1.y + corner_offset_y).
            // But the offset depends on the incoming and outgoing directions.
        }

        offsetPoints.push(p2_off);
    }

    // Better Approach for strictly Manhattan lines:
    // Just iterate points. For each point, determine the "Normal" based on the average of incoming/outgoing?
    // Or just construct segments and let SVG `stroke-linejoin="round"` handle the corner?
    // NO, because we are drawing distinct disjoint parallel paths.
    // We need to calculate the actual geometry path for this specific lane.

    // RE-DO: Simple Segment Offset + Intersection approach
    // But simplified for Manhattan (Segments are Axis Aligned)

    const polyPoints: Point[] = [];

    // Process Segments
    // We need 3 points window to find corner
    // But points array is P0, P1, P2...

    // Logic:
    // P0: Start. Offset is perpendicular to P0->P1.
    // Pi: Corner. Offset is intersection of parallel lines (P(i-1)->Pi) and (Pi->P(i+1)).
    // Pn: End. Offset perpendicular to P(n-1)->Pn.

    // Helper to get offset vector for a segment
    const getNormal = (a: Point, b: Point) => {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { x: 0, y: 0 };
        return { x: -dy / len, y: dx / len };
    };

    // First Point
    const nStart = getNormal(points[0], points[1]);
    polyPoints.push({
        x: points[0].x + nStart.x * offset,
        y: points[0].y + nStart.y * offset
    });

    // Middle Points (Corners)
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        const n1 = getNormal(prev, curr);
        const n2 = getNormal(curr, next);

        // Miter Join logic
        // Tangent vector at corner is average of two segment directions?
        // Actually, for parallel curves, the corner point C' is:
        // C + offset * (miter_vector)
        // miter_vector = (n1 + n2) / (1 + n1.dot(n2)) ... standard math.

        // But for Manhattan (90 deg), n1 and n2 are perpendicular.
        // n1 might be (0, 1), n2 might be (1, 0).
        // The miter vector is just (n1 + n2).
        // We assume strictly 90 degree turns.

        // Since (n1 + n2) has length sqrt(2), we literally just add both normals!
        // P_corner = P + offset * n1 + offset * n2 ?
        // Let's verify:
        // Horizontal seg (Right): N=(0,-1). Vertical seg (Down): N=(1,0).
        // Turn is Right-Down. Outside corner.
        // N1+N2 = (1, -1). 
        // Corner is shifted Right and Up. 
        // If offset is positive (Left side), n1=(0, -1) [Up], n2=(1, 0) [Right]. 
        // Wait, "Up" is negative Y in screen space. "Right" is +X.
        // "Left" of Right-Vector(1,0) is (0, -1) -> Up. Correct.
        // "Left" of Down-Vector(0,1) is (1, 0) -> Right. Correct.
        // Sum is (1, -1) -> Right-Up. 
        // This is the Outside Corner (Top-Right) of a Down-Right turn. Correct.

        // Wait, for an INSIDE turn:
        // Right -> Up.
        // N1 (Up), N2 (Left).
        // Sum is Up-Left. 
        // The corner moves "inward". Correct.

        // BUT: Simply adding normals (n1+n2) only works for the Vertex.
        // If we strictly connect the lines, we effectively just place the vertex at C + (n1+n2)*offset.

        polyPoints.push({
            x: curr.x + (n1.x + n2.x) * offset,
            y: curr.y + (n1.y + n2.y) * offset
        });
    }

    // Last Point
    const nEnd = getNormal(points[points.length - 2], points[points.length - 1]);
    const last = points[points.length - 1];
    polyPoints.push({
        x: last.x + nEnd.x * offset,
        y: last.y + nEnd.y * offset
    });

    // Build SVG Path
    return polyPoints.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');
}

export const ChannelRenderer: React.FC<ChannelRendererProps> = ({
    points,
    throughput,
    beltCapacity = 360,
    color = '#3b82f6', // Default blue-500
    isSelected = false,
    showFlow = true,
    bundleLanes = false,
    pattern,
    status = 'ok',
    flowMode = false
}) => {
    // Use thicker dimensions in flow mode
    const laneWidth = flowMode ? FLOW_MODE_LANE_WIDTH : LANE_WIDTH;
    const laneSpacing = flowMode ? FLOW_MODE_LANE_SPACING : LANE_SPACING;

    // 1. Calculate number of lanes
    const laneCount = getLaneCount(throughput, beltCapacity);

    // 2. Generate Parallel Paths
    const lanePaths = useMemo(() => {
        if (!points || points.length < 2) return [];

        const paths: string[] = [];
        const spread = (laneCount - 1) * laneSpacing;
        const startOffset = -spread / 2;

        for (let i = 0; i < laneCount; i++) {
            const offset = startOffset + (i * laneSpacing);
            paths.push(getOffsetPath(points, offset));
        }
        return paths;
    }, [points, laneCount, laneSpacing]);

    // 3. Generate Foundation (Background) Path
    // The foundation is just the center path, drawn very thick
    const foundationPath = useMemo(() => {
        if (!points || points.length < 2) return '';
        let d = `M ${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x},${points[i].y}`;
        }
        return d;
    }, [points]);

    // Foundation width covers all lanes plus padding
    const foundationWidth = getBeltFoundationWidth(laneCount, Boolean(flowMode));

    // Calculate animation duration based on saturation of ALL rendered lanes
    // If we have 2 lanes for 400/360 flow, capacity is 720, so speed should be slower.
    const effectiveCapacity = Math.max(beltCapacity, laneCount * beltCapacity);
    const flowDuration = Math.min(
        LAYOUT_METRICS.belt.flowDuration.maxSeconds,
        Math.max(
            LAYOUT_METRICS.belt.flowDuration.minSeconds,
            LAYOUT_METRICS.belt.flowDuration.baseMultiplier * (effectiveCapacity / Math.max(LAYOUT_METRICS.belt.flowDuration.throughputFloor, throughput))
        )
    );

    // Generate arrow markers for flow mode
    const arrowMarkers = useMemo(() => {
        if (!flowMode || !points || points.length < 2) return [];

        const markers: Array<{ x: number; y: number; angle: number }> = [];
        const ARROW_SPACING = LAYOUT_METRICS.belt.arrowSpacing;

        // Calculate total path length and place arrows along it
        let totalLength = 0;
        const segments: Array<{ start: Point; end: Point; length: number; cumLength: number }> = [];

        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            segments.push({
                start: points[i],
                end: points[i + 1],
                length: len,
                cumLength: totalLength + len
            });
            totalLength += len;
        }

        // Place arrows at regular intervals
        const numArrows = Math.floor(totalLength / ARROW_SPACING);
        for (let i = 1; i <= numArrows; i++) {
            const targetDist = i * ARROW_SPACING;

            // Find which segment this distance falls in
            for (const seg of segments) {
                if (targetDist <= seg.cumLength) {
                    const distIntoSeg = targetDist - (seg.cumLength - seg.length);
                    const t = distIntoSeg / seg.length;

                    const x = seg.start.x + (seg.end.x - seg.start.x) * t;
                    const y = seg.start.y + (seg.end.y - seg.start.y) * t;

                    // Calculate angle
                    const angle = Math.atan2(seg.end.y - seg.start.y, seg.end.x - seg.start.x) * (180 / Math.PI);

                    markers.push({ x, y, angle });
                    break;
                }
            }
        }

        return markers;
    }, [flowMode, points]);

    return (
        <g className="channel-renderer pointer-events-auto" style={{ willChange: 'transform' }}>
            {/* Inline styles for animation keyframes */}
            {/* Inline styles for animation keyframes - REMOVED, using SMIL */}
            {/* ... */}

            <defs>
                <pattern id="conflict-hatch" width={LAYOUT_METRICS.belt.conflictPatternSize} height={LAYOUT_METRICS.belt.conflictPatternSize} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width={LAYOUT_METRICS.belt.conflictPatternStripe} height={LAYOUT_METRICS.belt.conflictPatternSize} transform="translate(0,0)" fill="#ef4444" opacity="0.4"></rect>
                </pattern>
            </defs>

            {/* Foundation / Infrastructure Bed Shadow (Cheaper than drop-shadow filter) */}
                <path
                    d={foundationPath}
                    fill="none"
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={foundationWidth + LAYOUT_METRICS.belt.foundationShadowExtra}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: `translate(${LAYOUT_METRICS.belt.foundationShadowOffsetX}px, ${LAYOUT_METRICS.belt.foundationShadowOffsetY}px)` }}
                />
            {/* Foundation / Infrastructure Bed */}
            <path
                d={foundationPath}
                fill="none"
                stroke="#0f172a" // slate-900 (Darker foundation)
                strokeWidth={foundationWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    opacity: 0.9,
                    // Only use glow if selected, and use simpler filter
                    filter: isSelected ? `drop-shadow(0 0 4px ${color})` : undefined
                }}
            />

            {/* Conflict Overlay */}
            {pattern === 'conflict' && (
                <path
                    d={foundationPath}
                    fill="none"
                    stroke="url(#conflict-hatch)"
                    strokeWidth={foundationWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-100"
                />
            )}

            {/* Inner Highlight for Foundation (Glassmorphism effect) */}
            <path
                d={foundationPath}
                fill="none"
                stroke={color}
                strokeWidth={foundationWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-10"
            />

            {/* Individual Lanes or Bundled Ribbon */}
            {bundleLanes ? (
                <g>
                    <path
                        d={foundationPath}
                        stroke="#1e293b"
                        strokeWidth={foundationWidth - LAYOUT_METRICS.belt.bundleFoundationInset}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {showFlow && (
                        <path
                            d={foundationPath}
                            stroke={color}
                            strokeWidth={foundationWidth - LAYOUT_METRICS.belt.bundleFlowInset}
                            fill="none"
                            strokeLinecap="butt"
                            strokeLinejoin="round"
                            strokeDasharray={LAYOUT_METRICS.belt.dashArray}
                            style={{ opacity: 0.8 }}
                        >
                            <animate
                                attributeName="stroke-dashoffset"
                                from="0"
                                to={`${LAYOUT_METRICS.belt.dashOffset}`}
                                dur={`${flowDuration}s`}
                                repeatCount="indefinite"
                            />
                        </path>
                    )}
                </g>
            ) : (
                lanePaths.map((d, i) => (
                    <g key={`lane-group-${i}`}>
                        {/* Lane Track (Dark underlay) */}
                        <path
                            d={d}
                            stroke="#1e293b" // slate-800
                            strokeWidth={laneWidth + LAYOUT_METRICS.belt.laneTrackExtra}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={status === 'underload' ? '2 4' : 'none'}
                        />
                        {/* Moving Item Slugs */}
                        <path
                            d={d}
                            stroke={color}
                            strokeWidth={laneWidth - LAYOUT_METRICS.belt.laneFlowInset}
                            fill="none"
                            strokeLinecap={bundleLanes ? "butt" : "round"}
                            strokeLinejoin="round"
                            strokeDasharray={showFlow ? LAYOUT_METRICS.belt.dashArray : 'none'}
                            style={{
                                opacity: 1
                            }}
                        >
                            {showFlow && (
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from="0"
                                to={`${LAYOUT_METRICS.belt.dashOffset}`}
                                    dur={`${flowDuration}s`}
                                    repeatCount="indefinite"
                                />
                            )}
                        </path>
                        {/* Secondary highlights removed for performance */}
                    </g>
                ))
            )}

            {/* Direction arrows (flow mode only) */}
            {flowMode && arrowMarkers.map((marker, i) => (
                <g key={`arrow-${i}`} transform={`translate(${marker.x}, ${marker.y}) rotate(${marker.angle})`}>
                    <polygon
                        points="-6,-4 6,0 -6,4"
                        fill={color}
                        opacity={0.9}
                    />
                </g>
            ))}
        </g>
    );
};
