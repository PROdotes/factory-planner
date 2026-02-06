/**
 * ROLE: UI Component (Layout)
 * PURPOSE: Left sidebar container for the "Forge" (Recipe Catalog).
 */

import React from 'react';
import { FLOW_CONFIG } from '../LayoutConfig';

interface Props {
    isOpen: boolean;
    children: React.ReactNode;
}

export function LeftSidebar({ isOpen, children }: Props) {
    return (
        <aside
            className={`sidebar-container left ${isOpen ? 'open' : 'closed'}`}
            style={{
                width: FLOW_CONFIG.SIDEBAR_WIDTH,
                marginLeft: isOpen ? 0 : -FLOW_CONFIG.SIDEBAR_WIDTH,
                // --- Rule 13: Standard of Truth ---
                ['--sidebar-width' as any]: `${FLOW_CONFIG.SIDEBAR_WIDTH}px`,
                ['--sidebar-transition' as any]: `${FLOW_CONFIG.SIDEBAR_TRANSITION_MS}ms`,
                transition: `margin-left var(--sidebar-transition) ease-in-out`
            } as React.CSSProperties}
        >
            <div className="sidebar-content">
                {children}
            </div>
        </aside>
    );
}
