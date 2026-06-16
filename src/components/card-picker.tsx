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

type CardSet = { name: string; count: number; date: string | null };

export function CardPicker({
  onPick,
  onPickMultiple,
  onCancel,
}: {
  onPick: (card: CatalogCard) => void;
  onPickMultiple?: (cards: CatalogCard[]) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"search" | "browse">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Browse state
  const [sets, setSets] = useState<CardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [setCards, setSetCards] = useState<CatalogCard[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);

  // Multi-select state (browse mode only)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(card: CatalogCard) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(card.cardSetId)) {
        next.delete(card.cardSetId);
      } else {
        next.add(card.cardSetId);
      }
      return next;
    });
  }

  function addSelected() {
    if (!onPickMultiple || selected.size === 0) return;
    const cards = setCards.filter((c) => selected.has(c.cardSetId));
    onPickMultiple(cards);
    setSelected(new Set());
  }

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
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
        if (res.ok) setResults(await res.json());
      } catch { /* */ }
      setLoading(false);
    }, 120);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onPick(results[selectedIndex]);
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  async function loadSets() {
    if (sets.length > 0) return;
    setLoadingSets(true);
    try {
      const res = await fetch("/api/card-sets");
      setSets(await res.json());
    } catch { /* */ }
    setLoadingSets(false);
  }

  async function loadSetCards(setName: string) {
    setSelectedSet(setName);
    setLoadingSets(true);
    try {
      const res = await fetch(`/api/card-sets?set=${encodeURIComponent(setName)}`);
      setSetCards(await res.json());
    } catch { /* */ }
    setLoadingSets(false);
  }

  function switchToBrowse() {
    setMode("browse");
    loadSets();
  }

  return (
    <div className="fixed inset-0 z-50 sm:relative sm:inset-auto" onClick={onCancel}>
      <div className="absolute inset-0 bg-white/60 sm:hidden" />

      <div
        className="absolute inset-0 sm:relative flex flex-col bg-bg-elevated sm:border sm:border-[rgba(0,0,0,0.06)] sm:rounded-xl sm:mb-3 sm:max-h-[70vh] sm:overflow-hidden sm:shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with mode toggle */}
        <div className="flex-none border-b border-[rgba(0,0,0,0.06)] bg-bg-elevated">
          {/* Mode tabs */}
          <div className="flex items-center gap-0 px-4 pt-3">
            <button
              onClick={() => setMode("search")}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                mode === "search" ? "bg-bg-surface text-text" : "text-text-dim hover:text-text"
              }`}
            >
              Search
            </button>
            <button
              onClick={switchToBrowse}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                mode === "browse" ? "bg-bg-surface text-text" : "text-text-dim hover:text-text"
              }`}
            >
              Browse Sets
            </button>
            <div className="flex-1" />
            <button
              onClick={onCancel}
              className="text-text-dim hover:text-text active:opacity-70 text-sm font-medium py-1 px-2 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Search input — only in search mode */}
          {mode === "search" && (
            <div className="flex items-center gap-2.5 px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => doSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Card name or code..."
                enterKeyHint="search"
                className="flex-1 bg-transparent border-none outline-none text-base sm:text-sm text-text placeholder:text-text-dim"
              />
              {loading && <span className="text-text-dim text-xs animate-pulse">...</span>}
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); }} className="text-text-dim text-xs active:opacity-70">Clear</button>
              )}
            </div>
          )}

          {/* Set breadcrumb — in browse mode */}
          {mode === "browse" && selectedSet && (
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => { setSelectedSet(null); setSetCards([]); }}
                className="text-accent text-xs font-medium active:opacity-70"
              >
                ← All Sets
              </button>
              <span className="text-xs text-text-muted truncate">{selectedSet}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
          {/* Search mode */}
          {mode === "search" && (
            <>
              {results.length === 0 && query.length > 0 && !loading && (
                <div className="py-12 text-center text-text-dim text-sm">No cards found</div>
              )}
              {results.length === 0 && query.length === 0 && (
                <div className="py-12 text-center text-text-dim text-sm px-8">
                  Search for a card or <button onClick={switchToBrowse} className="text-accent underline">browse by set</button>
                </div>
              )}
              {results.map((card, i) => (
                <CardRow key={card.cardSetId + i} card={card} selected={i === selectedIndex} onPick={onPick} onHover={() => setSelectedIndex(i)} />
              ))}
            </>
          )}

          {/* Browse mode — set list */}
          {mode === "browse" && !selectedSet && (
            <>
              {loadingSets && <div className="py-8 text-center text-text-dim text-sm">Loading sets...</div>}
              {sets.map((s) => (
                <button
                  key={s.name}
                  onClick={() => loadSetCards(s.name)}
                  className="flex items-center justify-between w-full text-left px-4 py-3.5 sm:py-2.5 border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.03)] active:opacity-80 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{s.name}</div>
                    {s.date && <div className="text-[10px] text-text-dim">{s.date}</div>}
                  </div>
                  <span className="text-xs text-text-dim font-mono flex-none ml-3">{s.count} cards</span>
                </button>
              ))}
            </>
          )}

          {/* Browse mode — cards in selected set (multi-select) */}
          {mode === "browse" && selectedSet && (
            <>
              {loadingSets && <div className="py-8 text-center text-text-dim text-sm">Loading cards...</div>}
              {setCards.map((card, i) => (
                <div
                  key={card.cardSetId + i}
                  className={`flex items-center gap-3 w-full text-left border-b border-[rgba(0,0,0,0.04)] px-4 py-3 sm:py-2.5 cursor-pointer transition-colors active:opacity-80 ${
                    selected.has(card.cardSetId) ? "bg-[rgba(59,130,246,0.1)]" : "hover:bg-[rgba(59,130,246,0.05)]"
                  }`}
                  onClick={() => toggleSelect(card)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-none transition-colors ${
                    selected.has(card.cardSetId) ? "bg-accent border-accent" : "border-[rgba(0,0,0,0.15)]"
                  }`}>
                    {selected.has(card.cardSetId) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="relative w-9 h-[50px] sm:w-7 sm:h-[38px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
                    <img src={card.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                    <span className="text-[11px] text-text-dim">
                      {card.cardSetId} · {card.rarity} · {card.cardColor}
                    </span>
                  </span>
                  {card.marketPrice != null && card.marketPrice > 0 && (
                    <span className="font-mono text-xs font-semibold text-[#059669] flex-none">
                      {fmt(card.marketPrice)}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {results.length >= 30 && mode === "search" && (
          <div className="flex-none py-1.5 bg-[#F4F4F5] border-t border-[rgba(0,0,0,0.04)] text-center font-mono text-[10px] text-text-dim">
            Top 30 — refine your search
          </div>
        )}

        {/* Multi-select action bar */}
        {mode === "browse" && selected.size > 0 && (
          <div className="flex-none flex items-center gap-3 px-4 py-3 bg-bg-elevated border-t border-[rgba(0,0,0,0.08)]">
            <span className="text-sm text-text-muted">
              {selected.size} card{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-text-dim hover:text-text active:opacity-70 px-2 py-1"
            >
              Clear
            </button>
            <button
              onClick={addSelected}
              className="border border-[rgba(0,0,0,0.12)] text-text font-medium text-sm py-2.5 px-5 rounded-lg hover:bg-[rgba(0,0,0,0.06)] active:opacity-70 transition-colors"
            >
              Add {selected.size} card{selected.size !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardRow({
  card,
  selected,
  onPick,
  onHover,
}: {
  card: CatalogCard;
  selected: boolean;
  onPick: (card: CatalogCard) => void;
  onHover: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onPick(card); }}
      onTouchEnd={(e) => { e.preventDefault(); onPick(card); }}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 w-full text-left border-b border-[rgba(0,0,0,0.04)] px-4 py-3 sm:py-2.5 cursor-pointer transition-colors active:opacity-80 ${
        selected ? "bg-[rgba(59,130,246,0.08)]" : "hover:bg-[rgba(59,130,246,0.05)]"
      }`}
    >
      <div className="relative w-9 h-[50px] sm:w-7 sm:h-[38px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
        <img src={card.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      </div>
      <span className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
        <span className="text-[11px] text-text-dim">
          {card.cardSetId} · {card.rarity} · {card.cardColor}
        </span>
      </span>
      {card.marketPrice != null && card.marketPrice > 0 && (
        <span className="font-mono text-xs font-semibold text-[#059669] flex-none">
          {fmt(card.marketPrice)}
        </span>
      )}
    </button>
  );
}
