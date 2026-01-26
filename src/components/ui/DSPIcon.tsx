import React from 'react';
import iconsPath from '@/assets/icons.png';

interface DSPIconProps {
    index: number;
    size?: number;
    className?: string;
}


export const DSPIcon: React.FC<DSPIconProps> = ({ index, size = 32, className = '' }) => {
    const col = index % 16;
    const row = Math.floor(index / 16);

    return (
        <div
            className={`inline-block overflow-hidden flex-none ${className}`}
            style={{
                width: size,
                height: size,
                backgroundImage: `url(${iconsPath})`,
                backgroundPosition: `-${col * size}px -${row * size}px`,
                backgroundSize: `${16 * size}px auto`,
                imageRendering: 'pixelated'
            }}
        />
    );
};

// Map item IDs to their icon index in the sprite sheet (16-column grid)
export const ITEM_ICON_MAP: Record<string, number> = {
    'iron-ore': 2,
    'copper-ore': 3,
    'coal': 4,
    'stone': 5,
    'silicon-ore': 6,
    'titanium-ore': 7,
    'water': 8,
    'crude-oil': 9,
    'hydrogen': 10,
    'deuterium': 11,
    'antimatter': 12,
    'iron-ingot': 14,
    'copper-ingot': 15,
    'magnet': 26,
    'magnetic-coil': 27,
    'refined-oil': 21,
    'gear': 50,
    'circuit-board': 39,
    'electromagnetic-matrix': 72,
    'prism': 81,
    'electric-motor': 54,
    'micro-crystalline-component': 55,
    'processor': 76,
};
