/**
 * ROLE: UI Component (Atomic)
 * PURPOSE: Renders a DSP item icon from the master sprite sheet.
 * RELATION: Used in RateRows, PropertiesPanel, and Recipe Selectors.
 */

import { useGameDataStore } from "../../gamedata/gamedataStore";
import "./ItemIcon.css";

interface Props {
  itemId: string;
  size?: number;
  className?: string;
}

/**
 * MAPPING LOGIC:
 * The gridIndex in dsp.json is ZXXY.
 * Z: Page (1-2)
 * XX: Row (1-7)
 * Y: Column (1-14)
 *
 * icons.png is a unified sheet where icons are 80x80.
 */
export function ItemIcon({ itemId, size = 32, className = "" }: Props) {
  const { items } = useGameDataStore();
  const item = items[itemId];

  // Fallback if item not found or has no grid index
  if (!item || !item.gridIndex) {
    return (
      <div
        className={`item-icon-fallback ${className}`}
        style={{ width: size, height: size }}
      >
        {itemId.substring(0, 1).toUpperCase()}
      </div>
    );
  }

  const { iconIndex } = item;

  const ICON_SIZE = 64;
  const COLS = 23; // Updated for new webp geometry
  const SHEET_WIDTH = 1472;

  const spriteX = (iconIndex % COLS) * ICON_SIZE;
  const spriteY = Math.floor(iconIndex / COLS) * ICON_SIZE;

  const ratio = size / ICON_SIZE;

  return (
    <div
      className={`item-icon ${className}`}
      style={{
        width: size,
        height: size,
        backgroundPosition: `-${spriteX * ratio}px -${spriteY * ratio}px`,
        backgroundSize: `${SHEET_WIDTH * ratio}px auto`,
      }}
      title={item.name}
    />
  );
}
