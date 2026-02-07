import { useUIStore } from "../uiStore";

export function RateUnitToggle() {
  const { rateUnit, toggleRateUnit } = useUIStore();
  const isMin = rateUnit === "per_minute";

  return (
    <div
      className="rate-toggle"
      title="Toggle rate display between per minute and per second"
    >
      <span className="rate-toggle-label">Rates:</span>
      <button
        className={`rate-toggle-btn ${isMin ? "active" : ""}`}
        onClick={() => !isMin && toggleRateUnit()}
      >
        /min
      </button>
      <button
        className={`rate-toggle-btn ${!isMin ? "active" : ""}`}
        onClick={() => isMin && toggleRateUnit()}
      >
        /sec
      </button>
    </div>
  );
}
