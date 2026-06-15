"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function CardPicker({
  onPick,
  onCancel,
}: {
  onPick: (card: CatalogCard) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function doSearch(q: string) {
    setQuery(q);
    setSelectedIndex(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search-cards?q=${encodeURIComponent(q.trim())}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // aborted or network error
      } finally {
        setLoading(false);
      }
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(i + 1, results.length - 1);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.max(i - 1, 0);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onPick(results[selectedIndex]);
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  function scrollToIndex(index: number) {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl mb-3 overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
      {/* Search header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[rgba(255,255,255,0.06)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-dim flex-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by card name or code..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-dim"
        />
        {loading && (
          <span className="text-text-dim text-xs animate-pulse">...</span>
        )}
        <button
          onClick={onCancel}
          className="text-text-dim hover:text-text active:opacity-70 text-sm py-1 px-2 transition-colors flex-none"
        >
          Cancel
        </button>
      </div>

      {/* Results */}
      <div ref={listRef} className="max-h-[50vh] sm:max-h-[320px] overflow-y-auto">
        {results.length === 0 && query.length > 0 && !loading && (
          <div className="py-8 text-center text-text-dim text-sm">
            No cards found
          </div>
        )}
        {results.length === 0 && query.length === 0 && (
          <div className="py-8 text-center text-text-dim text-sm">
            Type a card name or code to search
          </div>
        )}
        {results.map((card, i) => (
          <button
            key={card.cardSetId + i}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(card);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`flex items-center gap-2.5 w-full text-left border-b border-[rgba(255,255,255,0.04)] px-3 py-3 sm:py-2 cursor-pointer transition-colors active:opacity-80 ${
              i === selectedIndex
                ? "bg-[rgba(59,130,246,0.08)]"
                : "bg-bg-surface hover:bg-[rgba(59,130,246,0.05)]"
            }`}
          >
            <div className="relative w-6 h-[33px] flex-none rounded overflow-hidden bg-[#1C1C1F]">
              <img
                src={card.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span className="font-mono text-[11px] text-text-dim flex-none w-[72px] hidden sm:block">
              {card.cardSetId}
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-text block truncate">
                {card.cardName}
              </span>
              <span className="text-[10px] text-text-dim">
                {card.setName} · {card.rarity}
              </span>
            </span>
            {card.marketPrice != null && card.marketPrice > 0 && (
              <span className="font-mono text-xs font-semibold text-[#4ADE80] flex-none">
                {fmt(card.marketPrice)}
              </span>
            )}
          </button>
        ))}
      </div>

      {results.length >= 30 && (
        <div className="py-1.5 bg-[#0D0D0F] border-t border-[rgba(255,255,255,0.04)] text-center font-mono text-[10px] text-text-dim">
          Showing top 30 — refine your search
        </div>
      )}
    </div>
  );
}
