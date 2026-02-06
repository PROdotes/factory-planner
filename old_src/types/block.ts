
import { Edge, NodeChange, EdgeChange, Connection, XYPosition } from 'reactflow';

export type EdgeData = BeltEdgeData;

export interface ConflictMarker {
    nodeId: string;
    reason: string;
    ids: string[];
}

export interface LayoutState {
    nodes: BlockNode[];
    edges: Edge<EdgeData>[];
    draggingItem: { recipeId?: string; type: 'block' | 'splitter' | 'new-block' } | null;
    activePort: { nodeId: string; portId: string; type: 'input' | 'output'; position: XYPosition } | null;
    dropPosition?: XYPosition; // For smart connect placement
    nodeConflicts: Set<string>;
    viewSettings: {
        showRates: boolean;
        showFlow: boolean;
        snapToGrid: boolean;
        flowMode: boolean;
        showDebugBounds: boolean;
        showLabels: boolean;
        bundleLanes: boolean;
        autoIncrementSource: boolean;
    };
    setViewSettings: (settings: Partial<LayoutState['viewSettings']>) => void;
    toggleViewSetting: (key: keyof LayoutState['viewSettings']) => void;
    setDraggingItem: (item: LayoutState['draggingItem']) => void;
    setActivePort: (port: Omit<LayoutState['activePort'], 'position'> | null, position?: XYPosition) => void;
    createAndConnect: (recipeId: string, position: XYPosition, sourcePort: { nodeId: string; portId: string; type: 'input' | 'output'; itemId?: string }) => void;

    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    onPortClick: (nodeId: string, portId: string, type: 'input' | 'output') => void;
    onNodeDragStop: (event: any) => void;

    recalculateFlows: (options?: { skipRateSolver?: boolean; onlyRouteNodeId?: string }) => void;
    cycleEdgeBelt: (edgeId: string) => void;

    exportLayout: () => void;
    importLayout: (json: string) => void;
    saveToStorage: () => void;
    loadFromStorage: () => void;
    resetLayout: () => void;
    refreshGlobalRates: () => void;

    addSplitter: (type: 'splitter' | 'merger' | 'balancer', position: XYPosition) => string;
    addBlock: (recipeId: string, position: XYPosition, options?: { targetRate?: number; primaryOutputId?: string }) => string;
    updateBlock: (id: string, updates: Partial<Block | SplitterNodeData>) => void;
    deleteBlock: (id: string) => void;
    deleteEdge: (id: string) => void;
}

export interface ModifierState {
    type: 'speed' | 'productivity' | 'none';
    level: number;
    includeConsumption: boolean;
}
import { beltItemsPerUnit, defaultBeltCapacity } from '@/lib/rates';
import { LAYOUT_METRICS } from '@/lib/layout/metrics';
import { GameDefinition } from './game';

export const BLOCK_LAYOUT = {
    HEADER: LAYOUT_METRICS.block.headerHeight,
    MIN_HEIGHT: LAYOUT_METRICS.block.minHeight,
    WIDTH: LAYOUT_METRICS.block.width,
    PORT_COLUMN_WIDTH: LAYOUT_METRICS.block.portColumnWidth,
    HEADER_TOP_HEIGHT: LAYOUT_METRICS.block.headerTopHeight,
    HEADER_CONTROLS_HEIGHT: LAYOUT_METRICS.block.headerControlsHeight,
    PADDING: LAYOUT_METRICS.block.padding,
    BODY_TOP_PADDING: LAYOUT_METRICS.block.bodyTopPadding,
    PORT_LABEL: LAYOUT_METRICS.block.portLabelHeight,
    PORT_ROW: LAYOUT_METRICS.block.portRowHeight,
    PORT_GAP: LAYOUT_METRICS.block.portGap,
    VISUAL_BELT_HEIGHT: LAYOUT_METRICS.belt.laneHeight.standard,
    BELT_STRIPE_GAP: LAYOUT_METRICS.block.beltStripeGap,
    LABEL_GAP: LAYOUT_METRICS.block.labelGap,
    LABEL_GROUP_HEIGHT: LAYOUT_METRICS.block.labelGroupHeight,
    LABEL_ICON_SIZE: LAYOUT_METRICS.block.labelIconSize,
    LABEL_STATUS_FONT_SIZE: LAYOUT_METRICS.block.labelStatusFontSize,
    LABEL_OPT_FONT_SIZE: LAYOUT_METRICS.block.labelOptFontSize,
    LABEL_NAME_FONT_SIZE: LAYOUT_METRICS.block.labelNameFontSize,
    LABEL_NAME_LINE_HEIGHT: LAYOUT_METRICS.block.labelNameLineHeight,
    LABEL_TRUTH_MAIN_FONT_SIZE: LAYOUT_METRICS.block.labelTruthMainFontSize,
    LABEL_TRUTH_SLASH_FONT_SIZE: LAYOUT_METRICS.block.labelTruthSlashFontSize,
    LABEL_TRUTH_TARGET_FONT_SIZE: LAYOUT_METRICS.block.labelTruthTargetFontSize,
    LABEL_GROUP_PADDING_X: LAYOUT_METRICS.block.labelGroupPaddingX,
    LABEL_TRUTH_GAP: LAYOUT_METRICS.block.labelTruthGap,
    PRIMARY_TOGGLE_PADDING: LAYOUT_METRICS.block.primaryTogglePadding,
    PRIMARY_TOGGLE_ICON_SIZE: LAYOUT_METRICS.block.primaryToggleIconSize,
    PRIMARY_TOGGLE_STROKE_WIDTH: LAYOUT_METRICS.block.primaryToggleStrokeWidth,
    HANDLE_SIZE: LAYOUT_METRICS.block.handleSize,
    HEADER_PADDING_TOP: LAYOUT_METRICS.block.header.paddingTop,
    HEADER_PADDING_BOTTOM: LAYOUT_METRICS.block.header.paddingBottom,
    HEADER_PADDING_X: LAYOUT_METRICS.block.header.paddingX,
    HEADER_ICON_WRAP_SIZE: LAYOUT_METRICS.block.header.iconWrapSize,
    HEADER_ICON_SIZE: LAYOUT_METRICS.block.header.iconSize,
    HEADER_SETTINGS_ICON_SIZE: LAYOUT_METRICS.block.header.settingsIconSize,
    HEADER_TITLE_FONT_SIZE: LAYOUT_METRICS.block.header.titleFontSize,
    HEADER_SUBTITLE_FONT_SIZE: LAYOUT_METRICS.block.header.subtitleFontSize,
    HEADER_TITLE_MAX_WIDTH: LAYOUT_METRICS.block.header.titleMaxWidth,
    HEADER_SUBTITLE_MAX_WIDTH: LAYOUT_METRICS.block.header.subtitleMaxWidth,
    HEADER_SUBTITLE_MARGIN_TOP: LAYOUT_METRICS.block.header.subtitleMarginTop,
    HEADER_RATE_INPUT_WIDTH: LAYOUT_METRICS.block.header.rateInputWidth,
    HEADER_RATE_INPUT_FONT_SIZE: LAYOUT_METRICS.block.header.rateInputFontSize,
    HEADER_RATE_INPUT_PADDING_X: LAYOUT_METRICS.block.header.rateInputPaddingX,
    HEADER_RATE_UNIT_FONT_SIZE: LAYOUT_METRICS.block.header.rateUnitFontSize,
    HEADER_RATE_UNIT_GAP: LAYOUT_METRICS.block.header.rateUnitGap,
    HEADER_RATE_EPSILON: LAYOUT_METRICS.block.header.rateEpsilon,
    HEADER_RATE_STEP: LAYOUT_METRICS.block.header.rateStep,
    HEADER_RATE_STEP_SHIFT: LAYOUT_METRICS.block.header.rateStepShift,
    HEADER_TEXT_GAP: LAYOUT_METRICS.block.header.textGap,
    HEADER_RATE_GAP: LAYOUT_METRICS.block.header.rateGap,
    HEADER_ACTUAL_FONT_SIZE: LAYOUT_METRICS.block.header.actualFontSize,
    HEADER_ACTUAL_GAP: LAYOUT_METRICS.block.header.actualGap,
    HEADER_DEMAND_FONT_SIZE: LAYOUT_METRICS.block.header.demandFontSize,
    HEADER_DEMAND_PADDING_LEFT: LAYOUT_METRICS.block.header.demandPaddingLeft,
    HEADER_DEMAND_MARGIN_TOP: LAYOUT_METRICS.block.header.demandMarginTop,
    HEADER_HINT_FONT_SIZE: LAYOUT_METRICS.block.header.hintFontSize,
    HEADER_HINT_ICON_SIZE: LAYOUT_METRICS.block.header.hintIconSize,
    HEADER_HINT_MARGIN_TOP: LAYOUT_METRICS.block.header.hintMarginTop,
    CENTER_ARROW_SIZE: LAYOUT_METRICS.block.center.arrowSize,
    CENTER_ARROW_STROKE: LAYOUT_METRICS.block.center.arrowStrokeWidth,
    CENTER_BADGE_PADDING_X: LAYOUT_METRICS.block.center.badgePaddingX,
    CENTER_BADGE_PADDING_Y: LAYOUT_METRICS.block.center.badgePaddingY,
    CENTER_BADGE_LABEL_SIZE: LAYOUT_METRICS.block.center.badgeLabelSize,
    CENTER_BADGE_LABEL_MARGIN: LAYOUT_METRICS.block.center.badgeLabelMarginBottom,
    CENTER_MACHINE_INPUT_WIDTH: LAYOUT_METRICS.block.center.machineInputWidth,
    CENTER_MACHINE_FONT_SIZE: LAYOUT_METRICS.block.center.machineInputFontSize,
    CENTER_MACHINE_STEP: LAYOUT_METRICS.block.center.machineStep,
    CENTER_MACHINE_STEP_SHIFT: LAYOUT_METRICS.block.center.machineStepShift,
    FOOTER_PADDING_X: LAYOUT_METRICS.block.footer.paddingX,
    FOOTER_TEXT_SIZE: LAYOUT_METRICS.block.footer.textSize,
    FOOTER_ICON_SIZE: LAYOUT_METRICS.block.footer.iconSize,
    FOOTER_GAP: LAYOUT_METRICS.block.footer.gap,
    FOOTER_BUTTON_PADDING_X: LAYOUT_METRICS.block.footer.buttonPaddingX,
    FOOTER_BUTTON_PADDING_Y: LAYOUT_METRICS.block.footer.buttonPaddingY,
    FOOTER_BUTTON_GAP: LAYOUT_METRICS.block.footer.buttonGap,
    CONTROLS_PADDING_X: LAYOUT_METRICS.block.controls.paddingX,
    CONTROLS_GAP: LAYOUT_METRICS.block.controls.gap,
    CONTROLS_MODIFIER_GAP: LAYOUT_METRICS.block.controls.modifierGap,
    CONTROLS_BUTTON_PADDING: LAYOUT_METRICS.block.controls.buttonPadding,
    CONTROLS_MODIFIER_TEXT_SIZE: LAYOUT_METRICS.block.controls.modifierTextSize,
    CONTROLS_MODIFIER_TEXT_PADDING_X: LAYOUT_METRICS.block.controls.modifierTextPaddingX,
    CONTROLS_MODIFIER_TEXT_PADDING_Y: LAYOUT_METRICS.block.controls.modifierTextPaddingY,
    CONTROLS_MACHINE_TEXT_SIZE: LAYOUT_METRICS.block.controls.machineTextSize,
    CONTROLS_MACHINE_PADDING_X: LAYOUT_METRICS.block.controls.machinePaddingX,
    CONTROLS_MACHINE_PADDING_Y: LAYOUT_METRICS.block.controls.machinePaddingY,
    CONTROLS_MACHINE_MAX_WIDTH: LAYOUT_METRICS.block.controls.machineMaxWidth,
    CONTROLS_ICON_SIZE: LAYOUT_METRICS.block.controls.iconSize,
    CONTROLS_CHEVRON_SIZE: LAYOUT_METRICS.block.controls.chevronSize,
    SPLITTER_CONFIG_OFFSET_Y: LAYOUT_METRICS.block.splitter.configOffsetY,
    SPLITTER_CONFIG_PADDING_X: LAYOUT_METRICS.block.splitter.configPaddingX,
    SPLITTER_CONFIG_PADDING_Y: LAYOUT_METRICS.block.splitter.configPaddingY,
    SPLITTER_CONFIG_FONT_SIZE: LAYOUT_METRICS.block.splitter.configFontSize,
    SPLITTER_CONFIG_GAP: LAYOUT_METRICS.block.splitter.configGap,
    SPLITTER_CONFIG_ICON_SIZE: LAYOUT_METRICS.block.splitter.configIconSize,
    SPLITTER_LABEL_OFFSET_Y: LAYOUT_METRICS.block.splitter.labelOffsetY,
    SPLITTER_LABEL_FONT_SIZE: LAYOUT_METRICS.block.splitter.labelFontSize,
    FLOW_BADGE_ACCENT_HEIGHT: LAYOUT_METRICS.block.flowBadge.accentHeight,
    FLOW_BADGE_ICON_SIZE: LAYOUT_METRICS.block.flowBadge.iconSize,
    FLOW_BADGE_COUNT_FONT_SIZE: LAYOUT_METRICS.block.flowBadge.countFontSize,
    FLOW_BADGE_ITEM_ICON_SIZE: LAYOUT_METRICS.block.flowBadge.itemIconSize,
    FLOW_BADGE_OUTPUT_FONT_SIZE: LAYOUT_METRICS.block.flowBadge.outputFontSize,
    FLOW_BADGE_GAP: LAYOUT_METRICS.block.flowBadge.badgeGap,
    FLOW_BADGE_ROW_GAP: LAYOUT_METRICS.block.flowBadge.rowGap,
    FLOW_BADGE_ICON_OPACITY: LAYOUT_METRICS.block.flowBadge.iconOpacity,
    FLOW_BADGE_DOT_SHADOW: LAYOUT_METRICS.block.flowBadge.portDotShadow,
    FLOW_BADGE_DOT_BORDER: LAYOUT_METRICS.block.flowBadge.portDotBorderWidth,
    ACCENT_BAR_HEIGHT: LAYOUT_METRICS.block.accentBarHeight,
    BODY_GRID_GAP: LAYOUT_METRICS.block.bodyGridGap,
    FOOTER: LAYOUT_METRICS.block.footerHeight,
    HANDLE_OFFSET: LAYOUT_METRICS.block.handleOffset,
    CENTER_BODY_MIN_HEIGHT: LAYOUT_METRICS.block.centerBodyMinHeight,
    CENTER_MIN_WIDTH: LAYOUT_METRICS.block.centerMinWidth,
    SPLITTER_SIZE: LAYOUT_METRICS.block.splitterSize
};

export const BLOCK_FLOW_LAYOUT = {
    WIDTH: LAYOUT_METRICS.flow.width,
    MIN_HEIGHT: LAYOUT_METRICS.flow.minHeight,
    LANE_SPACING: LAYOUT_METRICS.flow.laneSpacing,
    PORT_GAP: LAYOUT_METRICS.flow.portGap,
    V_PADDING: LAYOUT_METRICS.flow.verticalPadding,
    LANE_WIDTH: LAYOUT_METRICS.flow.laneWidth,
    FOUNDATION_PADDING: LAYOUT_METRICS.flow.foundationPadding,
    SPLITTER_SIZE: LAYOUT_METRICS.flow.splitterSize,
    HANDLE_SIZE: LAYOUT_METRICS.flow.handleSize
};

export function getBeltFoundationWidth(laneCount: number, flowMode: boolean): number {
    if (flowMode) {
        return ((laneCount - 1) * BLOCK_FLOW_LAYOUT.LANE_SPACING) + BLOCK_FLOW_LAYOUT.LANE_WIDTH + BLOCK_FLOW_LAYOUT.FOUNDATION_PADDING;
    }
    return ((laneCount - 1) * LAYOUT_METRICS.belt.standardLaneSpacing)
        + LAYOUT_METRICS.belt.standardFoundationBase
        + LAYOUT_METRICS.belt.standardFoundationPadding;
}

export interface Port {
    id: string;
    type: 'input' | 'output';
    itemId: string;
    rate: number; // Design rate (target)
    currentRate?: number; // Simulated flow (have)
    targetDemand?: number; // Backward-propagated request (want)
    side: 'left' | 'right' | 'top' | 'bottom';
    offset?: number; // 0-1 for standard mode
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom';

export interface Block {
    id: string;
    type: 'block';
    name: string;
    recipeId: string;
    machineId: string;
    calculationMode: 'output' | 'machines';
    targetRate: number;
    targetMachineCount?: number;
    machineCount: number;
    modifier?: ModifierState;
    inputPorts: Port[];
    outputPorts: Port[];
    actualRate: number;
    speedModifier: number;
    primaryOutputId?: string;
    efficiency?: number;
    size?: { width: number; height: number };
}

export type EdgeStatus = 'ok' | 'underload' | 'overload' | 'bottleneck' | 'conflict' | 'mismatch';

export interface CollisionRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface BeltEdgeData {
    beltId: string;
    capacity: number;
    flowRate: number;
    demandRate: number;
    status: EdgeStatus;
    itemId: string;
    points?: { x: number; y: number }[];
    collisionRects?: CollisionRect[];
}

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface SplitterNodeData {
    id: string;
    type: 'splitter' | 'merger' | 'balancer';
    priority: 'balanced' | 'out-left' | 'out-right' | 'in-left' | 'in-right';
    prioritySide?: 'left' | 'right';
    filterItemId?: string;
    inputPorts: Port[];
    outputPorts: Port[];
    size?: { width: number; height: number };
}

export type BlockNode = {
    id: string;
    type: 'block' | 'splitter';
    position: XYPosition;
    data: Block | SplitterNodeData;
    selected?: boolean;
    origin?: [number, number];
};

export function isBlock(data: Block | SplitterNodeData): data is Block {
    return (data as Block).type === 'block';
}

export function getPortVerticalOffset(index: number): number {
    return BLOCK_LAYOUT.PORT_LABEL + (index * (BLOCK_LAYOUT.PORT_ROW + BLOCK_LAYOUT.PORT_GAP));
}

export function getPortLanes(port: Port, game: GameDefinition): number {
    const beltCap = (game.belts && game.belts[0])
        ? beltItemsPerUnit(game.belts[0], game.settings.rateUnit)
        : defaultBeltCapacity(game.settings.rateUnit);
    // Cap visual lanes at 8 to prevent UI explosion, but respect design logic
    return Math.max(1, Math.min(8, Math.ceil((port.currentRate ?? port.rate) / beltCap)));
}

export interface PortLayout {
    port: Port;
    id: string;
    top: number;
    height: number;
    beltStackTop: number;
    beltStackHeight: number;
    labelBottomFromTop: number;
    lanes: number;
}

/**
 * Single source of truth for standard block port layout.
 */
export function calculateSideLayout(
    ports: Port[],
    game: GameDefinition | undefined,
    flowMode: boolean
): PortLayout[] {
    let currentY = 0;
    return ports.map((port, index) => {
        const beltHeight = flowMode ? LAYOUT_METRICS.belt.laneHeight.flow : LAYOUT_METRICS.belt.laneHeight.standard;
        const lanes = game ? getPortLanes(port, game) : 1;
        const beltStackHeight = lanes * beltHeight;
        const portHeight = Math.max(BLOCK_LAYOUT.PORT_ROW, beltStackHeight);

        const center = portHeight / 2;
        const topOfBelts = center - (beltStackHeight / 2);
        const labelTop = topOfBelts - BLOCK_LAYOUT.LABEL_GAP - BLOCK_LAYOUT.LABEL_GROUP_HEIGHT;
        const overflow = (!flowMode && labelTop < 0) ? Math.abs(labelTop) : 0;

        const gap = index === 0 ? 0 : Math.max(BLOCK_LAYOUT.PORT_GAP, BLOCK_LAYOUT.PORT_GAP + overflow);

        currentY += gap;
        const top = currentY;
        const height = portHeight;

        const labelBottomFromTop = topOfBelts - BLOCK_LAYOUT.LABEL_GAP;
        const beltStackTop = (height / 2) - (beltStackHeight / 2);

        currentY += portHeight;

        return {
            port,
            id: port.id,
            top,
            height,
            beltStackTop,
            beltStackHeight,
            labelBottomFromTop,
            lanes
        };
    });
}

export function getCalculatedSize(
    nodeData: Block | SplitterNodeData,
    flowMode: boolean = false,
    game?: GameDefinition
): { width: number; height: number } {
    if (!isBlock(nodeData)) {
        const size = flowMode ? BLOCK_FLOW_LAYOUT.SPLITTER_SIZE : BLOCK_LAYOUT.SPLITTER_SIZE;
        return { width: size, height: size };
    }

    if (flowMode && game) {
        const leftLayouts = calculateFlowSideLayout(nodeData, 'left', game);
        const rightLayouts = calculateFlowSideLayout(nodeData, 'right', game);
        const topLayouts = calculateFlowSideLayout(nodeData, 'top', game);
        const bottomLayouts = calculateFlowSideLayout(nodeData, 'bottom', game);

        const leftHeight = leftLayouts.length > 0 ? leftLayouts[leftLayouts.length - 1].offsetInBundle + BLOCK_FLOW_LAYOUT.LANE_WIDTH : 0;
        const rightHeight = rightLayouts.length > 0 ? rightLayouts[rightLayouts.length - 1].offsetInBundle + BLOCK_FLOW_LAYOUT.LANE_WIDTH : 0;
        const topWidth = topLayouts.length > 0 ? topLayouts[topLayouts.length - 1].offsetInBundle + BLOCK_FLOW_LAYOUT.LANE_WIDTH : 0;
        const bottomWidth = bottomLayouts.length > 0 ? bottomLayouts[bottomLayouts.length - 1].offsetInBundle + BLOCK_FLOW_LAYOUT.LANE_WIDTH : 0;

        const contentHeight = Math.max(leftHeight, rightHeight, BLOCK_FLOW_LAYOUT.MIN_HEIGHT) + (BLOCK_FLOW_LAYOUT.V_PADDING * 2);
        const contentWidth = Math.max(topWidth, bottomWidth, BLOCK_FLOW_LAYOUT.WIDTH);

        return { width: contentWidth, height: contentHeight };
    }

    // Standard Mode
    const leftLayout = calculateSideLayout(nodeData.inputPorts, game, false);
    const rightLayout = calculateSideLayout(nodeData.outputPorts, game, false);

    const leftHeight = leftLayout.length > 0 ? leftLayout[leftLayout.length - 1].top + leftLayout[leftLayout.length - 1].height : 0;
    const rightHeight = rightLayout.length > 0 ? rightLayout[rightLayout.length - 1].top + rightLayout[rightLayout.length - 1].height : 0;

    const maxPortsHeight = Math.max(leftHeight, rightHeight);
    const bodyHeight = Math.max(BLOCK_LAYOUT.CENTER_BODY_MIN_HEIGHT, maxPortsHeight + BLOCK_LAYOUT.BODY_TOP_PADDING);
    const calculatedHeight = BLOCK_LAYOUT.HEADER + bodyHeight + BLOCK_LAYOUT.FOOTER + (BLOCK_LAYOUT.PADDING * 2);

    return { width: BLOCK_LAYOUT.WIDTH, height: Math.max(BLOCK_LAYOUT.MIN_HEIGHT, calculatedHeight) };
}

export function getPortPosition(
    nodeData: Block | SplitterNodeData,
    nodePosition: XYPosition,
    port: Port,
    flowMode: boolean = false,
    game?: GameDefinition
): XYPosition {
    const { width, height } = getCalculatedSize(nodeData, flowMode, game);
    const x = Math.round(nodePosition.x);
    const y = Math.round(nodePosition.y);

    if (!isBlock(nodeData)) {
        return {
            x: port.side === 'right' ? x + width : (port.side === 'left' ? x : Math.round(x + width * (port.offset || 0.5))),
            y: port.side === 'bottom' ? y + height : (port.side === 'top' ? y : Math.round(y + height * (port.offset || 0.5)))
        };
    }

    if (flowMode && game) {
        const layouts = calculateFlowSideLayout(nodeData as Block, port.side, game);
        const portLayouts = layouts.filter(l => l.id === port.id);
        if (portLayouts.length === 0) return { x, y };
        const center = Math.round((portLayouts[0].offsetInBundle + portLayouts[portLayouts.length - 1].offsetInBundle) / 2);

        if (port.side === 'left' || port.side === 'right') return { x: port.side === 'left' ? x : x + width, y: y + center };
        return { x: x + center, y: port.side === 'top' ? y : y + height };
    }

    if (port.side === 'top' || port.side === 'bottom') return { x: Math.round(x + width * (port.offset || 0.5)), y: port.side === 'top' ? y - BLOCK_LAYOUT.HANDLE_OFFSET : y + height + BLOCK_LAYOUT.HANDLE_OFFSET };

    const sidePorts = port.type === 'input' ? nodeData.inputPorts : nodeData.outputPorts;
    const layouts = calculateSideLayout(sidePorts, game, false);
    const portLayout = layouts.find(l => l.id === port.id);

    if (!portLayout) return { x, y };

    const vOffset = Math.round(BLOCK_LAYOUT.HEADER + BLOCK_LAYOUT.PADDING + BLOCK_LAYOUT.BODY_TOP_PADDING + portLayout.top + (portLayout.height / 2));

    return {
        x: port.side === 'left' ? x - BLOCK_LAYOUT.HANDLE_OFFSET : x + width + BLOCK_LAYOUT.HANDLE_OFFSET,
        y: y + vOffset
    };
}

export interface FlowPortLayout {
    id: string;
    laneIdx: number;
    side: PortSide;
    type: 'input' | 'output';
    offsetInBundle: number;
}

export function calculateFlowSideLayout(
    data: Block,
    side: PortSide,
    game: GameDefinition
): FlowPortLayout[] {
    const { width, height } = getCalculatedSize(data, true, game);
    const { LANE_SPACING, PORT_GAP } = BLOCK_FLOW_LAYOUT;

    const sidePorts = [...data.inputPorts, ...data.outputPorts].filter(p => p.side === side);
    if (sidePorts.length === 0) return [];

    const totalLanes = sidePorts.reduce((sum, p) => sum + getPortLanes(p, game), 0);
    const totalSpan = ((totalLanes - 1) * LANE_SPACING) + ((sidePorts.length - 1) * PORT_GAP);
    const containerSize = (side === 'left' || side === 'right') ? height : width;
    const contentOffset = Math.round((containerSize - totalSpan) / 2);

    const layouts: FlowPortLayout[] = [];
    let currentTrace = contentOffset;

    for (const port of sidePorts) {
        const lanes = getPortLanes(port, game);
        for (let i = 0; i < lanes; i++) {
            layouts.push({
                id: port.id,
                laneIdx: i,
                side: side,
                type: port.type,
                offsetInBundle: currentTrace + (i * LANE_SPACING)
            });
        }
        currentTrace += ((lanes - 1) * LANE_SPACING) + PORT_GAP + LANE_SPACING;
    }

    return layouts;
}

export function getFlowPortLayouts(
    data: Block,
    game: GameDefinition
): FlowPortLayout[] {
    return ['left', 'right', 'top', 'bottom'].flatMap(side =>
        calculateFlowSideLayout(data, side as PortSide, game)
    );
}



