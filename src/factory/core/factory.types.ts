/**
 * ROLE: Data Schema (Logical Flow Layer)
 * PURPOSE: Defines the core structures using factory-domain terminology.
 * RELATION: This is the format the Solver understands.
 */

export interface FlowResult {
  actual: number; // What was produced/consumed by machines
  demand: number; // Factory max (total downstream capacity for outputs)
  capacity: number; // Machine capacity
  sent: number; // What actually left the block (gated by immediate downstream)
}

export interface FactoryBlock {
  id: string;
  name: string;
  type: "production" | "logistics" | "gatherer";
  position: { x: number; y: number };

  // Solver results (ABC Pillar)
  results: {
    flows: Record<string, FlowResult>;
    satisfaction: number;
  };

  // Configuration/State (Historical - to be purged after refactor)
  demand: Record<string, number>;
  supply: Record<string, number>;
  output: Record<string, number>;
  requested?: Record<string, number>;
  satisfaction: number;
  sourceYield?: number;
  inputOrder?: string[];
  outputOrder?: string[];
  done?: boolean;
}

export interface ProductionBlock extends FactoryBlock {
  type: "production";
  recipeId?: string;
  machineId?: string;
  machineCount?: number;
}

export interface LogisticsBlock extends FactoryBlock {
  type: "logistics";
}

export interface GathererBlock extends FactoryBlock {
  type: "gatherer";
  gathererId?: string;
  machineId?: string;
  sourceYield: number;
  machineCount?: number;
}

export interface Connection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  itemId: string;
  beltId?: string; // Optional belt tier (e.g., "conveyor-belt-mk-ii")
  demand: number;
  rate: number;
}

export interface FactoryLayout {
  blocks: Record<string, FactoryBlock>;
  connections: Connection[];
}
