import { useUIStore } from '../uiStore';
import { Activity } from 'lucide-react';

export function RateUnitToggle() {
    const { rateUnit, toggleRateUnit } = useUIStore();
    const isMin = rateUnit === 'per_minute';

    return (
        <button
            className="toolbar-btn"
            onClick={toggleRateUnit}
            title={isMin ? "Switch to Per Second (/s)" : "Switch to Per Minute (/m)"}
        >
            <Activity size={14} style={{ color: isMin ? 'var(--flow-success)' : 'var(--text-dim)' }} />
            <span style={{ fontSize: '0.65rem' }}>{isMin ? '/m' : '/s'}</span>
        </button>
    );
}
