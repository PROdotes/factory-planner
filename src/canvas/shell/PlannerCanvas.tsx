/**
 * ROLE: Flow Visualization Canvas
 * PURPOSE: Renders the logical production layout (Blocks and Connections) using the OOP Factory Graph.
 * RELATION: The primary interaction point for "Flow Mode".
 */

import { useEffect, useRef, useMemo } from "react";
import { useFactoryStore } from "../../factory/factoryStore";
import { BlockCard } from "../blocks/BlockCard";
import { ConnectionLines } from "../blocks/ConnectionLines";
import { useCanvasTransform } from "../hooks/useCanvasTransform";
import { useDragToSpawn } from "../hooks/useDragToSpawn";
import { useUIStore } from "../uiStore";

export function PlannerCanvas() {
  const factory = useFactoryStore((s) => s.factory);
  const selectBlock = useFactoryStore((s) => s.selectBlock);
  const version = useFactoryStore((s) => s.version);

  const { toggleFocus } = useUIStore();
  const {
    transform,
    transformRef,
    containerRef,
    contentRef,
    clientToWorld,
    handlers,
  } = useCanvasTransform();

  // 1. [Interaction State] - Track mouse for click vs pan detection
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // 2. [Keyboard Logic] - ESC to clear Deep Focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleFocus(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocus]);

  // Initialize drag-to-spawn listener
  useDragToSpawn(clientToWorld);

  // Force re-render only when 'factory' or 'version' changes
  const blocks = useMemo(
    () => Array.from(factory.blocks.values()),
    [factory, version]
  );

  const isZoomedIn = transform.scale >= 0.9;

  return (
    <div className="canvas-wrapper">
      <div
        className="node-grid"
        ref={containerRef}
        onMouseDown={(e) => {
          // Start tracking position for click-vs-pan detection
          if (e.target === containerRef.current) {
            mouseDownPos.current = { x: e.clientX, y: e.clientY };
          }
          handlers.onMouseDown(e);
        }}
        onMouseUp={(e) => {
          // Only deselect if it was a "clean" click (minimal movement)
          if (e.target === containerRef.current && mouseDownPos.current) {
            const dx = Math.abs(e.clientX - mouseDownPos.current.x);
            const dy = Math.abs(e.clientY - mouseDownPos.current.y);

            if (dx < 5 && dy < 5) {
              selectBlock(null);
            }
          }
          mouseDownPos.current = null;
        }}
        style={
          {
            overflow: "hidden",
            "--pan-x": `${transform.x}px`,
            "--pan-y": `${transform.y}px`,
            "--scale": transform.scale,
          } as any
        }
      >
        <div
          className="canvas-content"
          ref={contentRef}
          style={{
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
            position: "relative",
            pointerEvents: "none",
          }}
        >
          {/* 2. [Render Phase] */}
          <ConnectionLines clientToWorld={clientToWorld} />
          <div style={{ pointerEvents: "auto" }}>
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                isZoomedIn={isZoomedIn}
                transformRef={transformRef}
                version={version}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
