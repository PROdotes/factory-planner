// Header primitives (box-border: height includes padding)
const HEADER_PADDING_TOP = 16;
const HEADER_PADDING_BOTTOM = 12;
const HEADER_ICON_WRAP_SIZE = 40;
const HEADER_TOP = HEADER_PADDING_TOP + HEADER_PADDING_BOTTOM + HEADER_ICON_WRAP_SIZE;
const HEADER_CONTROLS = 34;
const HEADER_HEIGHT = HEADER_TOP + HEADER_CONTROLS;

// Belt primitive — ONE number controls all belt dimensions
const BELT_SIZE = 120;
const FLOW_BELT_SIZE = 8;

// Layout primitives
const PADDING = 10;
const BODY_TOP_PADDING = 14;
const BODY_GRID_GAP = 8;
const FOOTER = 30;
const PORT_COLUMN_WIDTH = 135;

// Center primitives
const CENTER_ARROW_SIZE = 48;
const CENTER_BODY_MIN = CENTER_ARROW_SIZE;
const CENTER_MACHINE_INPUT_WIDTH = 56;
const CENTER_BADGE_PADDING_X = 6;
const CENTER_BADGE_BORDER = 2;
const CENTER_MIN_WIDTH = CENTER_MACHINE_INPUT_WIDTH + (CENTER_BADGE_PADDING_X * 2) + CENTER_BADGE_BORDER;

// Block width: padding + portColumn + gap + center + gap + portColumn + padding
const BLOCK_WIDTH = (PADDING * 2) + (PORT_COLUMN_WIDTH * 2) + (BODY_GRID_GAP * 2) + CENTER_MIN_WIDTH;

// Label group primitives
const LABEL_ICON_SIZE = 18;
const LABEL_NAME_LINE_HEIGHT = 12;
const LABEL_GROUP_HEIGHT = LABEL_ICON_SIZE + LABEL_NAME_LINE_HEIGHT;

export const LAYOUT_METRICS = {
    block: {
        headerHeight: HEADER_HEIGHT,
        minHeight: HEADER_HEIGHT + BODY_TOP_PADDING + CENTER_BODY_MIN + FOOTER + (PADDING * 2),
        width: BLOCK_WIDTH,
        portColumnWidth: PORT_COLUMN_WIDTH,
        headerTopHeight: HEADER_TOP,
        headerControlsHeight: HEADER_CONTROLS,
        padding: PADDING,
        bodyTopPadding: BODY_TOP_PADDING,
        portLabelHeight: 24,
        portRowHeight: Math.max(64, BELT_SIZE),
        portGap: 8,
        portRateEpsilon: 0.1,
        labelGap: 2,
        labelGroupHeight: LABEL_GROUP_HEIGHT,
        labelIconSize: LABEL_ICON_SIZE,
        labelStatusFontSize: 12,
        labelOptFontSize: 9,
        labelNameFontSize: 9,
        labelNameLineHeight: LABEL_NAME_LINE_HEIGHT,
        labelTruthMainFontSize: 14,
        labelTruthSlashFontSize: 10,
        labelTruthTargetFontSize: 12,
        labelGroupPaddingX: 4,
        labelTruthGap: 4,
        primaryTogglePadding: 2,
        primaryToggleIconSize: 10,
        primaryToggleStrokeWidth: 3,
        footerHeight: FOOTER,
        handleOffset: 4,
        centerBodyMinHeight: CENTER_BODY_MIN,
        centerMinWidth: CENTER_MIN_WIDTH,
        splitterSize: 80,
        beltStripeGap: 1,
        handleSize: 12,
        header: {
            paddingTop: HEADER_PADDING_TOP,
            paddingBottom: HEADER_PADDING_BOTTOM,
            paddingX: 10,
            iconWrapSize: HEADER_ICON_WRAP_SIZE,
            iconSize: 32,
            settingsIconSize: 20,
            titleFontSize: 14,
            subtitleFontSize: 9,
            titleMaxWidth: 160,
            subtitleMaxWidth: 140,
            subtitleMarginTop: 4,
            rateInputWidth: 80,
            rateInputFontSize: 20,
            rateInputPaddingX: 4,
            rateUnitFontSize: 12,
            rateUnitGap: 4,
            actualFontSize: 10,
            demandFontSize: 9,
            hintFontSize: 8,
            hintIconSize: 8,
            rateEpsilon: 0.1,
            rateStep: 1,
            rateStepShift: 10,
            textGap: 12,
            rateGap: 16,
            actualGap: 6,
            demandPaddingLeft: 6,
            demandMarginTop: 2,
            hintMarginTop: 2
        },
        controls: {
            paddingX: 16,
            gap: 8,
            modifierGap: 4,
            buttonPadding: 4,
            modifierTextSize: 9,
            modifierTextPaddingX: 6,
            modifierTextPaddingY: 2,
            machineTextSize: 10,
            machinePaddingX: 8,
            machinePaddingY: 2,
            machineMaxWidth: 150,
            iconSize: 12,
            chevronSize: 10
        },
        center: {
            arrowSize: CENTER_ARROW_SIZE,
            arrowStrokeWidth: 3,
            badgePaddingX: CENTER_BADGE_PADDING_X,
            badgeBorder: CENTER_BADGE_BORDER,
            badgePaddingY: 4,
            badgeLabelSize: 8,
            badgeLabelMarginBottom: 2,
            machineInputWidth: CENTER_MACHINE_INPUT_WIDTH,
            machineInputFontSize: 20,
            machineInputStep: 0.1,
            machineStep: 1,
            machineStepShift: 10
        },
        footer: {
            paddingX: 10,
            textSize: 9,
            iconSize: 11,
            gap: 16,
            buttonPaddingX: 6,
            buttonPaddingY: 2,
            buttonGap: 4
        },
        splitter: {
            configOffsetY: 48,
            configPaddingX: 8,
            configPaddingY: 4,
            configFontSize: 10,
            configGap: 4,
            configIconSize: 10,
            labelOffsetY: 24,
            labelFontSize: 9
        },
        flowBadge: {
            accentHeight: 2,
            iconSize: 16,
            countFontSize: 18,
            itemIconSize: 16,
            outputFontSize: 10,
            badgeGap: 4,
            rowGap: 6,
            iconOpacity: 0.8,
            portDotShadow: '0 0 8px rgba(0,0,0,0.5)',
            portDotBorderWidth: 2
        },
        accentBarHeight: 4,
        bodyGridGap: BODY_GRID_GAP
    },
    flow: {
        width: 80,
        minHeight: 56,
        laneSpacing: FLOW_BELT_SIZE + 2,
        portGap: 24,
        verticalPadding: 20,
        laneWidth: FLOW_BELT_SIZE,
        foundationPadding: 12,
        splitterSize: 40,
        handleSize: 10
    },
    belt: {
        laneHeight: {
            standard: BELT_SIZE,
            flow: FLOW_BELT_SIZE
        },
        standardLaneWidth: BELT_SIZE / 3,
        standardLaneSpacing: BELT_SIZE / 2,
        standardFoundationBase: BELT_SIZE / 3,
        standardFoundationPadding: BELT_SIZE * 2 / 3,
        arrowSpacing: 80,
        flowDuration: {
            minSeconds: 0.4,
            maxSeconds: 8,
            baseMultiplier: 1.0,
            throughputFloor: 0.1
        },
        clickableStrokeMin: 20,
        laneTrackExtra: 2,
        laneFlowInset: 0.5,
        foundationShadowExtra: 2,
        foundationShadowOffsetX: 1,
        foundationShadowOffsetY: 2,
        bundleFoundationInset: 4,
        bundleFlowInset: 8,
        dashArray: '8 22',
        dashOffset: -30,
        conflictPatternSize: 8,
        conflictPatternStripe: 4
    },
    labels: {
        offsetX: 12,
        flowTranslateY: '-150%',
        standardTranslateY: '-100%',
        flowYOffset: 4,
        standardYOffset: 8,
        bottleneckEpsilon: 0.1,
        shortageEpsilon: 0.1,
        containerPaddingX: 6,
        containerPaddingY: 2,
        containerGap: 8,
        dotSize: 6,
        dotMargin: 4,
        iconWrapSize: 32,
        iconInnerSize: 28,
        iconSize: 28,
        rateFontSize: 13,
        rateUnitFontSize: 8,
        bottleneckFontSize: 9,
        bottleneckPaddingX: 6,
        bottleneckBorderWidth: 1,
        shortageGap: 6,
        shortageBorderWidth: 2,
        shortagePaddingLeft: 10,
        shortagePaddingRight: 4,
        shortageMarginLeft: 4,
        shortagePaddingY: 2,
        shortageIconSize: 12,
        shortageValueFontSize: 15
    },
    routing: {
        gridSpacing: 10,
        maxIterations: 10000,
        turnPenalty: 300,
        overlapPenalty: 2000,
        overlapHardPenalty: 10000,
        breakoutDistance: {
            standard: 20,
            flow: 40,
            minDistance: 10,
            shrinkOffset: 5
        },
        splitterPlacementDistance: {
            standard: 100,
            flow: 60
        },
        fallbackPortOffset: 300,
        scanOffsets: [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]
    },
    debug: {
        collisionEpsilon: 0.01,
        rateEpsilon: 0.001
    }
} as const;
