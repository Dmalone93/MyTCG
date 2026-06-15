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
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Clamp position to keep menu in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
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
              className="w-full text-left px-3 py-2 text-text-muted hover:bg-[rgba(255,255,255,0.04)] hover:text-text transition-colors"
            >
              {col.name}
            </button>
          ))}
          <div className="border-t border-[rgba(255,255,255,0.04)] my-1" />
        </>
      )}
      <button
        onClick={onDelete}
        className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-400/10 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
