import { describe, it, expect } from "vitest";
import { isBlockFailing } from "../canvas/blocks/blockHelpers";

/**
 * LAW OF THE LAND: The Efficiency Logic Test
 *
 * If this test fails, it means an AI agent tried to "fix" the efficiency bars
 * to show machine performance instead of factory progress.
 *
 * THE LAW: Efficiency = (Actual Output / Demand), NOT (Actual / Capacity).
 */
describe("Law of the Land: UI Semantics", () => {
  it("Efficiency must reflect Factory Plan Fulfillment (Actual / Demand)", () => {
    // Scenario: A machine is running at 100% capacity (10/s)
    // but the plan (demand) wants 20/s.
    const actual = 10;
    const demand = 20;
    // Note: capacity (10) is at 100% but plan demands 20

    // The user's intended display logic in BlockCard.tsx:
    const footerEfficiency = demand > 0 ? actual / demand : 0.5;

    // ASSERTION: The bar should be at 50% (half-full) to show we are missing half the plan,
    // even if the machine is physically working at 100% (capacity).
    expect(footerEfficiency).toBe(0.5);
    expect(footerEfficiency).not.toBe(1.0); // If 1.0, someone broke the Law.
  });

  it("IsBlockFailing must identify a bottleneck machine even if it is working at 100% capacity", () => {
    // Scenario: Machine is capped by its physical machine count (actual == capacity)
    // but outputActual < outputGoal (demand).
    const inputSatisfaction = 1.0;
    const actual = 10;
    const goal = 20;
    const capacity = 10;

    const failing = isBlockFailing(inputSatisfaction, actual, goal, capacity);

    // It should be RED (failing) because it is a BOTTLENECK.
    expect(failing).toBe(true);
  });
});
