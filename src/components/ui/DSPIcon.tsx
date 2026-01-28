import React from 'react';
import { useGameStore } from '@/stores/gameStore';

interface DSPIconProps {
    index: number;
    size?: number;
    className?: string;
}

export const DSPIcon: React.FC<DSPIconProps> = ({ index, size = 32, className = '' }) => {
    const { game } = useGameStore();
    const spriteConfig = game.spriteSheet || {
        url: '/icons.png',
        columns: 16
    };

    const col = index % spriteConfig.columns;
    const row = Math.floor(index / spriteConfig.columns);

    return (
        <div
            className={`inline-block overflow-hidden flex-none ${className}`}
            style={{
                width: size,
                height: size,
                backgroundImage: `url(${spriteConfig.url})`,
                backgroundPosition: `-${col * size}px -${row * size}px`,
                backgroundSize: `${spriteConfig.columns * size}px auto`,
                imageRendering: 'pixelated'
            }}
        />
    );
};
