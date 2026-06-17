"use client";

import { useRef, useCallback } from "react";

/**
 * Hook for swipe-down-to-dismiss on mobile bottom sheets.
 * Returns pointer event handlers to attach to the modal content div.
 * When the user swipes down past the threshold, onDismiss is called.
 */
export function useSwipeDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle touch
    if (e.pointerType !== "touch") return;
    // Only start drag if at the top of scroll (not mid-scroll)
    const el = elementRef.current;
    if (el && el.scrollTop > 0) return;

    isDragging.current = true;
    startY.current = e.clientY;
    currentY.current = e.clientY;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    currentY.current = e.clientY;
    const dy = currentY.current - startY.current;

    // Only allow downward drag
    if (dy < 0) {
      isDragging.current = false;
      if (elementRef.current) elementRef.current.style.transform = "";
      return;
    }

    // Apply visual feedback — translate the modal down
    if (elementRef.current) {
      elementRef.current.style.transform = `translateY(${dy}px)`;
      elementRef.current.style.transition = "none";
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dy = currentY.current - startY.current;

    if (elementRef.current) {
      elementRef.current.style.transition = "transform 0.2s ease-out";
      if (dy > threshold) {
        // Dismiss — slide out
        elementRef.current.style.transform = "translateY(100%)";
        setTimeout(onDismiss, 200);
      } else {
        // Snap back
        elementRef.current.style.transform = "";
      }
    }
  }, [onDismiss, threshold]);

  const onPointerCancel = useCallback(() => {
    isDragging.current = false;
    if (elementRef.current) {
      elementRef.current.style.transition = "transform 0.2s ease-out";
      elementRef.current.style.transform = "";
    }
  }, []);

  return {
    ref: elementRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
