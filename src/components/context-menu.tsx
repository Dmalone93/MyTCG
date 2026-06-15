"use client";

import { useEffect, useRef } from "react";
import type { Collection } from "./collection-shell";

export function ContextMenu({
  x,
  y,
  collections,
  currentCollectionId,
  onMove,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  collections: Collection[];
  currentCollectionId: string;
  onMove: (targetCollectionId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Clamp position to keep menu in viewport
  const menuWidth = 200;
  const menuHeight = 250;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, clampedX),
    top: Math.max(8, clampedY),
    zIndex: 100,
  };

  const otherCollections = collections.filter(
    (c) => c.id !== currentCollectionId
  );

  return (
    <div
      ref={ref}
      style={style}
      className="bg-bg-elevated border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1.5 min-w-[180px] text-sm"
    >
      {otherCollections.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-[10px] font-mono tracking-[.1em] uppercase text-text-dim">
            Move to
          </div>
          {otherCollections.map((col) => (
            <button
              key={col.id}
              onClick={() => onMove(col.id)}
              className="w-full text-left px-3 py-2.5 text-text-muted hover:bg-[rgba(255,255,255,0.04)] hover:text-text active:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              {col.name}
            </button>
          ))}
          <div className="border-t border-[rgba(255,255,255,0.04)] my-1" />
        </>
      )}
      <button
        onClick={onDelete}
        className="w-full text-left px-3 py-2.5 text-red-400 hover:bg-red-400/10 active:bg-red-400/15 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
