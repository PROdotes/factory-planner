import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChannelRenderer } from '../ChannelRenderer';

describe('ChannelRenderer', () => {
    it('renders without crashing for a simple path', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
        ];

        const { container } = render(
            <svg>
                <ChannelRenderer points={points} throughput={120} />
            </svg>
        );

        const paths = container.querySelectorAll('path');
        expect(paths.length).toBeGreaterThan(0);
    });
});
