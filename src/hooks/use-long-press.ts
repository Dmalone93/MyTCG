import { useRef, useCallback } from "react";

type LongPressHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

/**
 * Long-press hook: fires callback after ~500ms hold.
 * Cancels on move (>10px) or pointer up. Also fires on right-click.
 */
export function useLongPress(
  onLongPress: (x: number, y: number) => void,
  delay = 500
): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only primary button (left click / touch)
      if (e.button !== 0) return;
      fired.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress(e.clientX, e.clientY);
        cancel();
      }, delay);
    },
    [onLongPress, delay, cancel]
  );

  const onPointerUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        cancel();
      }
    },
    [cancel]
  );

  const onPointerLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // If long-press already fired, don't double-fire
      if (!fired.current) {
        onLongPress(e.clientX, e.clientY);
      }
      cancel();
    },
    [onLongPress, cancel]
  );

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onPointerLeave,
    onContextMenu,
  };
}
