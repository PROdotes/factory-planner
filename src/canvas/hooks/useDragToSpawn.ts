/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Handles dragging a new block from the Forge onto the Canvas.
 * RELATION: Instantiated in PlannerCanvas, triggered by ForgeList via CustomEvent.
 */

import { useEffect, useRef } from "react";
import { useFactoryStore } from "../../factory/factoryStore";

export interface DragSpawnPayload {
  type: "recipe" | "sink" | "generator" | "junction";
  recipeId?: string;
  machineId?: string;
  label: string;
}

declare global {
  interface WindowEventMap {
    "spawn-drag-start": CustomEvent<{
      clientX: number;
      clientY: number;
      payload: DragSpawnPayload;
    }>;
  }
}

export function useDragToSpawn(
  clientToWorld: (x: number, y: number) => { x: number; y: number }
) {
  const { addBlock, addLogistics, setRecipe } = useFactoryStore();
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const activePayload = useRef<DragSpawnPayload | null>(null);

  useEffect(() => {
    const startDrag = (
      e: CustomEvent<{
        clientX: number;
        clientY: number;
        payload: DragSpawnPayload;
      }>
    ) => {
      const { clientX, clientY, payload } = e.detail;
      activePayload.current = payload;

      // Create ghost
      const ghost = document.createElement("div");
      ghost.className = "spawn-ghost";
      ghost.textContent = payload.label;
      ghost.style.position = "fixed";
      ghost.style.left = `${clientX}px`;
      ghost.style.top = `${clientY}px`;
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "1000";
      ghost.style.opacity = "0.9";
      ghost.style.padding = "8px 16px";
      ghost.style.background = "var(--accent)";
      ghost.style.boxShadow = "0 0 15px var(--accent-glow)";
      ghost.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      ghost.style.borderRadius = "8px";
      ghost.style.color = "white";
      ghost.style.fontSize = "0.8rem";
      ghost.style.fontWeight = "600";
      ghost.style.transform = "translate(-50%, -50%)";
      ghost.style.backdropFilter = "blur(4px)";

      document.body.appendChild(ghost);
      ghostRef.current = ghost;

      const handleMouseMove = (moveEv: MouseEvent) => {
        if (ghostRef.current) {
          ghostRef.current.style.left = `${moveEv.clientX}px`;
          ghostRef.current.style.top = `${moveEv.clientY}px`;
        }
      };

      const handleMouseUp = (upEv: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if (ghostRef.current) {
          document.body.removeChild(ghostRef.current);
          ghostRef.current = null;
        }

        const world = clientToWorld(upEv.clientX, upEv.clientY);
        const p = activePayload.current;
        if (!p) return;

        // Execution
        if (p.type === "recipe" && p.recipeId) {
          const block = addBlock(p.label, world.x, world.y);
          setRecipe(block.id, p.recipeId);
        } else if (p.type === "generator" && p.machineId) {
          const block = addBlock(p.label, world.x, world.y);
          // Use setMachine directly for generators
          const { setMachine } = useFactoryStore.getState();
          setMachine(block.id, p.machineId);
        } else if (p.type === "sink") {
          addBlock(p.label, world.x, world.y);
        } else if (p.type === "junction") {
          addLogistics(world.x, world.y);
        }

        activePayload.current = null;
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("spawn-drag-start", startDrag as any);
    return () =>
      window.removeEventListener("spawn-drag-start", startDrag as any);
  }, [addBlock, addLogistics, setRecipe, clientToWorld]);
}
