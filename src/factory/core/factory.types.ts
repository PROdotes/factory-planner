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
  type: "block" | "sink" | "logistics";
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
}

export interface ProductionBlock extends FactoryBlock {
  type: "block";
  recipeId?: string;
  machineId?: string;
  machineCount?: number;
}

export interface StorageBlock extends FactoryBlock {
  type: "sink";
}

export interface LogisticsBlock extends FactoryBlock {
  type: "logistics";
  subtype: "splitter" | "merger" | "knot";
}

export interface Connection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  itemId: string;
  demand: number;
  rate: number;
}

export interface FactoryLayout {
  blocks: Record<string, FactoryBlock>;
  connections: Connection[];
}
