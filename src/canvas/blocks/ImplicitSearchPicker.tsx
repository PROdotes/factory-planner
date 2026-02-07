/**
 * ROLE: UI Component (Contextual Construction)
 * PURPOSE: Offers a list of blocks that either consume or produce the item being dragged.
 * RELATION: Triggered by ConnectionLines on "Drop to Empty Space".
 */

import { useMemo, useEffect, useRef, useState, useLayoutEffect } from "react";
import { useUIStore } from "../uiStore";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { useFactoryStore } from "../../factory/factoryStore";
import { ItemIcon } from "./ItemIcon";
import { GitBranch, X, ArrowRightLeft } from "lucide-react";

export function ImplicitSearchPicker() {
  const { implicitSearch, setImplicitSearch } = useUIStore();
  const { recipes, items, gatherers } = useGameDataStore();
  const {
    addBlock,
    setRecipe,
    addLogistics,
    connect,
    runSolver,
    addGatherer,
    setGatherer,
    factory,
  } = useFactoryStore();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });

  // Reset adjusted pos when search changes
  useEffect(() => {
    if (implicitSearch) {
      setAdjustedPos(implicitSearch.clientPos);
    }
  }, [implicitSearch]);

  // Filter recipes based on the dragged item
  const results = useMemo(() => {
    if (!implicitSearch) return [];
    const { itemId, side } = implicitSearch;

    return Object.values(recipes).filter((recipe) => {
      if (side === "right") {
        // Dragging Output -> Find Consumers (where itemId is an input)
        return recipe.inputs.some((inp) => inp.itemId === itemId);
      } else {
        // Dragging Input -> Find Producers (where itemId is an output)
        return recipe.outputs.some((out) => out.itemId === itemId);
      }
    });
  }, [implicitSearch, recipes]);

  const matchingGatherers = useMemo(() => {
    if (!implicitSearch || implicitSearch.side === "right") return [];
    const { itemId } = implicitSearch;
    return Object.values(gatherers).filter((g) => g.outputItemId === itemId);
  }, [implicitSearch, gatherers]);

  // Find existing blocks to connect to
  const existingConnections = useMemo(() => {
    if (!implicitSearch) return [];
    const { blockId, itemId, side } = implicitSearch;

    const filteredBlocks = Array.from(factory.blocks.values()).filter(
      (block) => {
        if (block.id === blockId) return false; // Don't connect to self

        // Check if already connected
        const isConnected = factory.connections.some(
          (c) =>
            c.itemId === itemId &&
            ((side === "right" &&
              c.sourceBlockId === blockId &&
              c.targetBlockId === block.id) ||
              (side === "left" &&
                c.sourceBlockId === block.id &&
                c.targetBlockId === blockId))
        );
        if (isConnected) return false;

        // Check compatibility
        if (side === "right") {
          // We are Outputting Item -> Look for Consumers
          // 1. Production Block with matching input
          if (block.type === "production") {
            const recipe = (block as any).recipeId
              ? recipes[(block as any).recipeId]
              : null;
            return recipe?.inputs.some((i) => i.itemId === itemId);
          }
          // 2. Logistics (Junctions accept anything IF not already carrying something else)
          if (block.type === "logistics") {
            const blockConnections = factory.connections.filter(
              (c) =>
                c.sourceBlockId === block.id || c.targetBlockId === block.id
            );
            if (blockConnections.length === 0) return true;
            // Must match item
            return blockConnections.every((c) => c.itemId === itemId);
          }
        } else {
          // We need Input Item -> Look for Producers
          // 1. Production Block with matching output
          if (block.type === "production") {
            const recipe = (block as any).recipeId
              ? recipes[(block as any).recipeId]
              : null;
            return recipe?.outputs.some((o) => o.itemId === itemId);
          }
          // 2. Gatherer with matching output
          if (block.type === "gatherer") {
            const gatherer = (block as any).gathererId
              ? gatherers[(block as any).gathererId]
              : null;
            return gatherer?.outputItemId === itemId;
          }
          // 3. Logistics (Junctions supply anything if fed)
          if (block.type === "logistics") {
            const blockConnections = factory.connections.filter(
              (c) =>
                c.sourceBlockId === block.id || c.targetBlockId === block.id
            );
            if (blockConnections.length === 0) return true;
            return blockConnections.every((c) => c.itemId === itemId);
          }
        }
        return false;
      }
    );

    // Sort by type (production > gatherer > logistics) and distance
    const { worldPos } = implicitSearch;
    return filteredBlocks.sort((a: any, b: any) => {
      // Type Priority: Production (0) > Gatherer (1) > Logistics (2)
      const typePriority = { production: 0, gatherer: 1, logistics: 2 };
      const priorityA = typePriority[a.type as keyof typeof typePriority] ?? 99;
      const priorityB = typePriority[b.type as keyof typeof typePriority] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const distA =
        (a.position.x - worldPos.x) ** 2 + (a.position.y - worldPos.y) ** 2;
      const distB =
        (b.position.x - worldPos.x) ** 2 + (b.position.y - worldPos.y) ** 2;
      return distA - distB;
    });
  }, [implicitSearch, factory.blocks, factory.connections, recipes, gatherers]);

  // Viewport Clamping (LayoutEffect + ResizeObserver)
  useLayoutEffect(() => {
    if (!implicitSearch || !pickerRef.current) return;

    const { clientPos } = implicitSearch;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const performClamp = () => {
      if (!pickerRef.current) return;
      const rect = pickerRef.current.getBoundingClientRect();

      let x = clientPos.x;
      let y = clientPos.y;

      // Clamp Right
      if (x + rect.width > viewportW - 20) {
        x = viewportW - rect.width - 20;
      }
      // Clamp Bottom
      if (y + rect.height > viewportH - 20) {
        y = viewportH - rect.height - 60; // More aggressive lift
      }
      // Clamp Left/Top (safety)
      if (x < 20) x = 20;
      if (y < 20) y = 20;

      setAdjustedPos({ x, y });
    };

    // 1. Initial Clamp
    performClamp();

    // 2. Observer for content size changes
    const observer = new ResizeObserver(() => {
      performClamp();
    });
    observer.observe(pickerRef.current);

    return () => observer.disconnect();
  }, [implicitSearch, results, matchingGatherers, existingConnections]);

  // Handle clicks outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setImplicitSearch(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImplicitSearch(null);
    };

    if (implicitSearch) {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [implicitSearch, setImplicitSearch]);

  if (!implicitSearch) return null;

  const { blockId, itemId, side, worldPos } = implicitSearch;
  const itemName = items[itemId]?.name || itemId;

  const handleSelectRecipe = (recipeId: string, recipeName: string) => {
    const newBlock = addBlock(recipeName, worldPos.x, worldPos.y);
    setRecipe(newBlock.id, recipeId);

    // Auto-connect
    if (side === "right") {
      connect(blockId, newBlock.id, itemId);
    } else {
      connect(newBlock.id, blockId, itemId);
    }

    runSolver();
    setImplicitSearch(null);
  };

  const handleSelectLogistics = () => {
    const newBlock = addLogistics(worldPos.x, worldPos.y);

    // Auto-connect
    if (side === "right") {
      connect(blockId, newBlock.id, itemId);
    } else {
      connect(newBlock.id, blockId, itemId);
    }

    runSolver();
    setImplicitSearch(null);
  };

  const handleSelectGatherer = (gathererId: string, gathererName: string) => {
    const newBlock = addGatherer(gathererName, worldPos.x, worldPos.y);
    setGatherer(newBlock.id, gathererId);

    // Auto-connect
    // Side is left (input looking for producer), so connect gatherer (newBlock) TO blockId
    connect(newBlock.id, blockId, itemId);

    runSolver();
    setImplicitSearch(null);
  };

  const handleConnectExisting = (targetBlockId: string) => {
    if (implicitSearch?.side === "right") {
      connect(implicitSearch.blockId, targetBlockId, implicitSearch.itemId);
    } else if (implicitSearch) {
      connect(targetBlockId, implicitSearch.blockId, implicitSearch.itemId);
    }
    runSolver();
    setImplicitSearch(null);
  };

  return (
    <div
      className="implicit-picker"
      ref={pickerRef}
      style={{
        top: adjustedPos.y,
        left: adjustedPos.x,
      }}
    >
      <div className="picker-header">
        <ItemIcon itemId={itemId} size={16} />
        <span>
          {side === "right" ? "Who consumes" : "Who produces"} <b>{itemName}</b>
          ?
        </span>
        <button className="close-btn" onClick={() => setImplicitSearch(null)}>
          <X size={14} />
        </button>
      </div>

      <div className="picker-body">
        <div className="picker-section">
          <div className="section-title">Logistics & Storage</div>
          <div className="logistics-grid">
            <button className="picker-item-btn" onClick={handleSelectLogistics}>
              <GitBranch size={16} />
              <span>Junction</span>
            </button>
          </div>
        </div>

        {existingConnections.length > 0 && (
          <div className="picker-section">
            <div className="section-title">Connect to Existing</div>
            <div className="recipe-grid">
              {existingConnections.map((block) => {
                let icon = <ArrowRightLeft size={16} className="icon-subtle" />;
                let title = block.name;
                let subtitle = `${Math.round(block.position.x)}, ${Math.round(
                  block.position.y
                )}`;
                let style = {
                  border: "1px dashed var(--accent)",
                  background: "rgba(241, 196, 15, 0.05)",
                };

                if (block.type === "production") {
                  const recipeId = (block as any).recipeId;
                  const recipe = recipeId ? recipes[recipeId] : null;
                  if (recipe) {
                    title = "Assembler";
                    subtitle = `${recipe.name}`;
                    // Show the item relevant to the connection
                    const relevantItem =
                      implicitSearch?.side === "right"
                        ? recipe.inputs.find(
                            (i) => i.itemId === implicitSearch?.itemId
                          )?.itemId
                        : recipe.outputs.find(
                            (o) => o.itemId === implicitSearch?.itemId
                          )?.itemId;

                    if (relevantItem) {
                      icon = <ItemIcon itemId={relevantItem} size={20} />;
                    }
                  }
                } else if (block.type === "logistics") {
                  icon = <GitBranch size={16} color="var(--flow-success)" />;
                  title = "Junction";
                  const connectionCount = factory.connections.filter(
                    (c) =>
                      c.sourceBlockId === block.id ||
                      c.targetBlockId === block.id
                  ).length;
                  subtitle = `${Math.round(block.position.x)}, ${Math.round(
                    block.position.y
                  )} • ${connectionCount} Links`;
                  style = {
                    border: "1px dashed var(--flow-success)",
                    background: "rgba(6, 182, 212, 0.05)",
                  };
                } else if (block.type === "gatherer") {
                  const gathererId = (block as any).gathererId;
                  const gatherer = gathererId ? gatherers[gathererId] : null;
                  if (gatherer) {
                    icon = (
                      <ItemIcon itemId={gatherer.outputItemId} size={20} />
                    );
                  }
                }

                return (
                  <button
                    key={block.id}
                    className="picker-recipe-btn existing-conn-btn"
                    onClick={() => handleConnectExisting(block.id)}
                    style={style}
                  >
                    {icon}
                    <div className="btn-col">
                      <span className="btn-title">{title}</span>
                      <span
                        className="btn-subtitle"
                        style={{ fontSize: "0.7rem", opacity: 0.7 }}
                      >
                        {subtitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {matchingGatherers.length > 0 && (
          <div className="picker-section">
            <div className="section-title">Gathering</div>
            <div className="recipe-grid">
              {matchingGatherers.map((g) => (
                <button
                  key={g.id}
                  className="picker-recipe-btn"
                  onClick={() => handleSelectGatherer(g.id, g.name)}
                >
                  <ItemIcon itemId={g.outputItemId} size={20} />
                  <span>{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="picker-section">
            <div className="section-title">Recipes</div>
            <div className="recipe-grid">
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  className="picker-recipe-btn"
                  onClick={() => handleSelectRecipe(recipe.id, recipe.name)}
                >
                  <ItemIcon
                    itemId={
                      side === "right"
                        ? recipe.outputs[0]?.itemId
                        : recipe.outputs[0]?.itemId
                    }
                    size={20}
                  />
                  <span>{recipe.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="picker-empty">
            No recipes found that {side === "right" ? "use" : "produce"} this
            item.
          </div>
        )}
      </div>
    </div>
  );
}
