/**
 * ROLE: State Management Utility
 * PURPOSE: Manages undo/redo stacks for factory state snapshots.
 * RELATION: Used by factoryStore for history management.
 */

import { FactoryGraph } from "./core/FactoryGraph";
import { serializeGraph } from "./graphSerializer";

const MAX_UNDO_STACK_SIZE = 50;

let undoStack: string[] = [];
let redoStack: string[] = [];

/**
 * Undo/Redo manager for factory state.
 * Uses JSON serialization of the factory graph for snapshots.
 */
export const undoRedoManager = {
  /**
   * Pushes the current factory state to the undo stack.
   * Only pushes if the state differs from the last snapshot.
   * Clears the redo stack on new action.
   */
  push(factory: FactoryGraph): void {
    const snapshot = serializeGraph(factory);
    // Only push if different from last
    if (
      undoStack.length === 0 ||
      undoStack[undoStack.length - 1] !== snapshot
    ) {
      undoStack.push(snapshot);
      if (undoStack.length > MAX_UNDO_STACK_SIZE) {
        undoStack.shift();
      }
      redoStack = []; // Clear redo on new action
    }
  },

  /**
   * Pops from the undo stack.
   * Returns the previous state snapshot, or null if stack is empty.
   * Caller must push current state to redo stack before calling.
   */
  popUndo(): string | null {
    if (undoStack.length === 0) return null;
    return undoStack.pop() ?? null;
  },

  /**
   * Pops from the redo stack.
   * Returns the next state snapshot, or null if stack is empty.
   * Caller must push current state to undo stack before calling.
   */
  popRedo(): string | null {
    if (redoStack.length === 0) return null;
    return redoStack.pop() ?? null;
  },

  /**
   * Pushes a snapshot to the redo stack.
   * Used when undoing to enable redo.
   */
  pushToRedo(snapshot: string): void {
    redoStack.push(snapshot);
  },

  /**
   * Pushes a snapshot to the undo stack.
   * Used when redoing to enable undo.
   */
  pushToUndo(snapshot: string): void {
    undoStack.push(snapshot);
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {
      undoStack.shift();
    }
  },

  /**
   * Checks if undo is available.
   */
  canUndo(): boolean {
    return undoStack.length > 0;
  },

  /**
   * Checks if redo is available.
   */
  canRedo(): boolean {
    return redoStack.length > 0;
  },

  /**
   * Clears both stacks. Used for testing or reset scenarios.
   */
  clear(): void {
    undoStack = [];
    redoStack = [];
  },
};
