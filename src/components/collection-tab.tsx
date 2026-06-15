"use client";

import { useState, useRef, useEffect } from "react";
import type { Collection } from "./collection-shell";

export function CollectionTab({
  collection,
  isActive,
  onClick,
  onRename,
  onDelete,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
}: {
  collection: Collection;
  isActive: boolean;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(collection.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitRename() {
    setEditing(false);
    if (editValue.trim() && editValue.trim() !== collection.name) {
      onRename(editValue.trim());
    } else {
      setEditValue(collection.name);
    }
  }

  return (
    <div
      className={`group relative flex items-center gap-1 px-3 py-2.5 sm:py-2 rounded-lg text-sm font-medium cursor-pointer select-none transition-colors flex-none active:opacity-80 ${
        isActive
          ? "bg-bg-surface text-text border border-[rgba(255,255,255,0.06)]"
          : "text-text-muted hover:text-text hover:bg-[rgba(255,255,255,0.03)]"
      }`}
      onClick={() => {
        if (!editing) onClick();
      }}
      onDoubleClick={() => {
        setEditValue(collection.name);
        setEditing(true);
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditValue(collection.name);
              setEditing(false);
            }
          }}
          className="bg-transparent border-none outline-none text-sm font-medium text-text w-[80px]"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate max-w-[120px]">{collection.name}</span>
      )}

      {/* Delete button — visible on hover */}
      {isActive && !editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${collection.name}"?`)) {
              onDelete();
            }
          }}
          className="ml-1 text-text-dim hover:text-red-400 active:text-red-400 text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1"
          title="Delete collection"
        >
          ×
        </button>
      )}
    </div>
  );
}
