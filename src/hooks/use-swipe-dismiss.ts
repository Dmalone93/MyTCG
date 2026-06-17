"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Hook for swipe-down-to-dismiss on mobile bottom sheets.
 * Attach `handleRef` to the drag handle element (the little bar at the top).
 * Attach `sheetRef` to the modal content div (for transform animation).
 */
export function useSwipeDismiss(onDismiss: () => void, threshold = 60) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current) return;
    currentY.current = e.touches[0].clientY;
    const dy = currentY.current - startY.current;

    if (dy < 0) {
      // Swiping up — cancel
      isDragging.current = false;
      if (sheetRef.current) {
        sheetRef.current.style.transform = "";
        sheetRef.current.style.transition = "";
      }
      return;
    }

    // Prevent page scroll while dragging
    e.preventDefault();

    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dy = currentY.current - startY.current;

    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.2s ease-out";
      if (dy > threshold) {
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onDismiss, 200);
      } else {
        sheetRef.current.style.transform = "";
      }
    }
  }, [onDismiss, threshold]);

  // Attach touch listeners to the drag handle
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { sheetRef, handleRef };
}
