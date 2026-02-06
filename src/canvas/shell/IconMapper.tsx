/**
 * ROLE: Maintenance Utility
 * PURPOSE: Allows manual mapping of item IDs to sprite sheet indices.
 * RELATION: One-time use tool to fix the icons in dsp.json.
 */

import { useState, useMemo } from "react";
import { useGameDataStore } from "../../gamedata/gamedataStore";
import { X, Search, Copy, Check } from "lucide-react";
import "./IconMapper.css";

export function IconMapper({ onClose }: { onClose: () => void }) {
  const { items } = useGameDataStore();
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [localMapping, setLocalMapping] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [filterUnused, setFilterUnused] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);

  // Sprite sheet config (Updated for 23-column icons.webp)
  const ICON_SIZE = 64;
  const SHEET_WIDTH = 1472;
  const COLS = 23;
  const TOTAL_ICONS = 515;

  // 1. [Sprite Usage Analytics] - Map index -> Item Name
  const spriteUsage = useMemo(() => {
    const usage: Record<number, string> = {};
    Object.values(items).forEach((item) => {
      if (item.iconIndex !== undefined && item.iconIndex !== 0) {
        usage[item.iconIndex] = item.name;
      }
    });
    return usage;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase();
    return Object.values(items)
      .filter((item) => {
        const matchesQuery =
          item.name.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query);
        if (!matchesQuery) return false;
        // If showAllItems is on, show everything that matches search
        if (showAllItems) return true;
        // Otherwise only show items with no icon (0)
        return item.iconIndex === 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, showAllItems]);

  const handleIconClick = (index: number) => {
    if (selectedItemId) {
      setLocalMapping((prev) => ({ ...prev, [selectedItemId]: index }));
    }
  };

  const handleCopy = () => {
    // Export as a clean Dictionary { "item-id": index } for the Python patcher
    navigator.clipboard.writeText(JSON.stringify(localMapping, null, 4));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="icon-mapper-overlay">
      <div className="icon-mapper-card">
        <div className="mapper-header">
          <div className="header-left">
            <h2>Icon Mapping Calibration</h2>
            <div
              className="header-toggles"
              style={{ display: "flex", gap: "12px" }}
            >
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filterUnused}
                  onChange={(e) => setFilterUnused(e.target.checked)}
                />
                <span>Hide Used</span>
              </label>
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={showAllItems}
                  onChange={(e) => setShowAllItems(e.target.checked)}
                />
                <span>Show All Items</span>
              </label>
            </div>
          </div>
          <div className="header-actions">
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>Copy Batch JSON</span>
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mapper-body">
          {/* Sidebar: Item List */}
          <div className="mapper-sidebar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="item-list">
              {filteredItems.map((item) => {
                const currentIndex =
                  localMapping[item.id] ?? item.iconIndex ?? 0;
                const oldIndex = item.iconIndex ?? 0;

                // Old Sheet Config (16 cols)
                const OLD_COLS = 16;
                const OLD_WIDTH = 1024;

                return (
                  <div
                    key={item.id}
                    className={`item-row ${
                      selectedItemId === item.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <div className="item-previews">
                      {/* OLD REFERENCE */}
                      <div className="preview-container">
                        <span className="preview-label">Old</span>
                        <div
                          className="mini-icon old"
                          style={{
                            backgroundImage: "url('/icons.png')",
                            backgroundPosition: `-${
                              (oldIndex % OLD_COLS) * 16
                            }px -${Math.floor(oldIndex / OLD_COLS) * 16}px`,
                            backgroundSize: `${(OLD_WIDTH / 64) * 16}px auto`,
                          }}
                        />
                      </div>
                      {/* NEW MAPPING */}
                      <div className="preview-container">
                        <span className="preview-label">New</span>
                        <div
                          className="mini-icon"
                          style={{
                            backgroundImage: "url('/icons.webp')",
                            backgroundPosition: `-${
                              (currentIndex % COLS) * 16
                            }px -${Math.floor(currentIndex / COLS) * 16}px`,
                            backgroundSize: `${
                              (SHEET_WIDTH / ICON_SIZE) * 16
                            }px auto`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-idx">New Idx: {currentIndex}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main: Sprite Sheet Viewer */}
          <div className="sprite-viewer">
            <div className="sprite-grid">
              {Array.from({ length: TOTAL_ICONS }).map((_, i) => {
                const usedByName = spriteUsage[i];
                const isUsedGlobal = !!usedByName;
                const isMappedLocal = localMapping[selectedItemId || ""] === i;

                if (filterUnused && isUsedGlobal) return null;

                return (
                  <div
                    key={i}
                    className={`sprite-slot ${isUsedGlobal ? "used" : ""} ${
                      isMappedLocal ? "mapped" : ""
                    }`}
                    onClick={() => handleIconClick(i)}
                    title={
                      usedByName
                        ? `Index ${i}: ${usedByName}`
                        : `Index ${i} (Unused)`
                    }
                  >
                    <div
                      className="sprite-img"
                      style={{
                        backgroundImage: "url('/icons.webp')",
                        backgroundPosition: `-${(i % COLS) * ICON_SIZE}px -${
                          Math.floor(i / COLS) * ICON_SIZE
                        }px`,
                        backgroundSize: `${SHEET_WIDTH}px auto`,
                        opacity: isUsedGlobal ? 0.3 : 1,
                      }}
                    />
                    <span className="slot-idx">{i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedItemId && (
          <div className="mapper-footer">
            <div className="footer-preview-comparison">
              <div className="footer-preview-item">
                <span className="footer-preview-label">Old Reference</span>
                <div
                  className="large-icon"
                  style={{
                    backgroundImage: "url('/icons.png')",
                    backgroundPosition: `-${
                      ((items[selectedItemId]?.iconIndex ?? 0) % 16) * 64
                    }px -${
                      Math.floor((items[selectedItemId]?.iconIndex ?? 0) / 16) *
                      64
                    }px`,
                    backgroundSize: `1024px auto`,
                  }}
                />
                <span className="footer-idx">
                  Idx: {items[selectedItemId]?.iconIndex}
                </span>
              </div>

              <div className="footer-arrow">→</div>

              <div className="footer-preview-item">
                <span className="footer-preview-label">New Mapping</span>
                <div
                  className="large-icon"
                  style={{
                    backgroundImage: "url('/icons.webp')",
                    backgroundPosition: `-${
                      ((localMapping[selectedItemId] ??
                        items[selectedItemId]?.iconIndex ??
                        0) %
                        COLS) *
                      64
                    }px -${
                      Math.floor(
                        (localMapping[selectedItemId] ??
                          items[selectedItemId]?.iconIndex ??
                          0) / COLS
                      ) * 64
                    }px`,
                    backgroundSize: `${SHEET_WIDTH}px auto`,
                  }}
                />
                <span className="footer-idx">
                  Idx:{" "}
                  {localMapping[selectedItemId] ??
                    items[selectedItemId]?.iconIndex ??
                    0}
                </span>
              </div>
            </div>
            <div className="footer-text">
              Mapping <b>{items[selectedItemId]?.name}</b> to Index{" "}
              <b>
                {localMapping[selectedItemId] ??
                  items[selectedItemId]?.iconIndex ??
                  0}
              </b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
