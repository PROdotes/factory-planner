import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Manages panning and zooming of the infinite grid canvas.
 */

export function useCanvasTransform() {
    // Current "Official" transform for React-dependent components
    const [transformState, setTransformState] = useState({ x: 0, y: 0, scale: 1 });

    // Internal high-speed Ref for the "Game Loop"
    const transform = useRef({ x: 0, y: 0, scale: 1 });
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isPanned = useRef(false);

    // Update DOM directly (Imperative path)
    const updateDOM = useCallback(() => {
        if (!containerRef.current || !contentRef.current) return;

        const { x, y, scale } = transform.current;

        // 1. Update the outer grid (CSS Variables for the infinite background)
        const grid = containerRef.current;
        grid.style.setProperty('--pan-x', `${x}px`);
        grid.style.setProperty('--pan-y', `${y}px`);
        grid.style.setProperty('--scale', `${scale}`);

        // 2. Update the inner content (Physical transformation)
        contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

        // 3. Sync state to React occasionally (e.g. for drag math)
        // We do this less frequently to avoid flooding the main thread
        setTransformState({ x, y, scale });
    }, []);

    const handleWheel = useCallback((e: WheelEvent) => {
        if (!containerRef.current) return;

        // Don't zoom if scrolling over a control field (machine count, rate inputs)
        const target = e.target as HTMLElement;
        if (target.closest('.control-field')) {
            return; // Let the control field handle the scroll
        }

        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY;
        const scaleFactor = 1.1; // Slightly slower for smooth wheels
        const oldScale = transform.current.scale;
        const newScale = delta > 0 ? oldScale / scaleFactor : oldScale * scaleFactor;

        const clampedScale = Math.min(Math.max(newScale, 0.02), 4);

        const worldX = (mouseX - transform.current.x) / oldScale;
        const worldY = (mouseY - transform.current.y) / oldScale;

        transform.current.x = mouseX - worldX * clampedScale;
        transform.current.y = mouseY - worldY * clampedScale;
        transform.current.scale = clampedScale;

        requestAnimationFrame(updateDOM);
    }, [updateDOM]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            isPanned.current = true;
        }
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isPanned.current) return;

            transform.current.x += e.movementX;
            transform.current.y += e.movementY;

            requestAnimationFrame(updateDOM);
        };

        const handleMouseUp = () => {
            isPanned.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [updateDOM]);

    const clientToWorld = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: clientX, y: clientY };
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        return {
            x: (mouseX - transform.current.x) / transform.current.scale,
            y: (mouseY - transform.current.y) / transform.current.scale
        };
    }, []);

    useEffect(() => {
        const onPanTo = (e: any) => {
            if (!containerRef.current) return;
            const { x, y } = e.detail;
            const rect = containerRef.current.getBoundingClientRect();

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const scale = transform.current.scale;

            transform.current.x = centerX - x * scale;
            transform.current.y = centerY - y * scale;

            requestAnimationFrame(updateDOM);
        };

        window.addEventListener('canvas-pan-to', onPanTo as any);
        return () => window.removeEventListener('canvas-pan-to', onPanTo as any);
    }, [updateDOM]);

    return {
        transform: transformState, // React-synced version
        containerRef,
        contentRef,
        clientToWorld,
        handlers: {
            onMouseDown: handleMouseDown
        }
    };
}
