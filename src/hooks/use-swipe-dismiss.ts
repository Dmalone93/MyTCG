"use client";

import { useRef, useEffect } from "react";

/**
 * Swipe-down-to-dismiss on mobile bottom sheets.
 * Attach handleRef to the drag handle area (larger touch target).
 * Attach sheetRef to the modal content div.
 */
export function useSwipeDismiss(onDismiss: () => void, threshold = 60) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Prevent pull-to-refresh on Android
      e.preventDefault();
      isDragging.current = true;
      startY.current = e.touches[0].clientY;
      currentY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      currentY.current = e.touches[0].clientY;
      const dy = currentY.current - startY.current;

      if (dy < 0) {
        isDragging.current = false;
        if (sheetRef.current) {
          sheetRef.current.style.transform = "";
          sheetRef.current.style.transition = "";
        }
        return;
      }

      e.preventDefault();
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        sheetRef.current.style.transition = "none";
      }
    };

    const onTouchEnd = () => {
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
    };

    // Use passive: false on touchstart to allow preventDefault (blocks pull-to-refresh)
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onDismiss, threshold]);

  return { sheetRef, handleRef };
}
