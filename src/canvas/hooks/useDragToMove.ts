/**
 * ROLE: UI Hook (Interaction)
 * PURPOSE: Handles mouse drag logic for moving blocks on the canvas.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useDragToMove(
    id: string,
    initialX: number,
    initialY: number,
    onMove: (id: string, x: number, y: number) => void,
    scale: number = 1
) {
    const [isDragging, setIsDragging] = useState(false);
    const [wasDragged, setWasDragged] = useState(false);
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const [anchor, setAnchor] = useState({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const hasMovedRef = useRef(false);

    // Sync local state if external prop changes (and not dragging)
    useEffect(() => {
        if (!isDragging) {
            setPosition({ x: initialX, y: initialY });
        }
    }, [initialX, initialY, isDragging]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return; // Left click only
        e.stopPropagation();

        setAnchor({
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: position.x,
            posY: position.y
        });
        setIsDragging(true);
        hasMovedRef.current = false;
        setWasDragged(false);
    }, [position]);

    const posRef = useRef(position);
    useEffect(() => { posRef.current = position; }, [position]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = (e.clientX - anchor.mouseX) / scale;
            const dy = (e.clientY - anchor.mouseY) / scale;

            // Simple movement threshold to distinguish drag from click
            if (!hasMovedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                hasMovedRef.current = true;
                setWasDragged(true);
            }

            const newX = anchor.posX + dx;
            const newY = anchor.posY + dy;

            setPosition({ x: newX, y: newY });

            // Dispatch transient event for other UI elements (like connections) to follow
            window.dispatchEvent(new CustomEvent('block-transient-move', {
                detail: { id, x: newX, y: newY }
            }));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            onMove(id, posRef.current.x, posRef.current.y);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, anchor, id, onMove, scale]);

    return {
        position,
        isDragging,
        wasDragged,
        handlers: {
            onMouseDown: handleMouseDown
        }
    };
}
