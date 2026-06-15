"use client";

import { useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

type ExtInfo = {
  card: {
    type: string;
    color: string;
    cost: number | null;
    power: number | null;
    life: number | null;
    rarity: string;
    traits: string;
    effect: string;
    altArt: string | null;
    setName: string;
    counterPower: number | null;
  };
  synergies: Array<{
    cid: string;
    name: string;
    imageUrl: string;
  }>;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [ext, setExt] = useState<ExtInfo | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function doSearch(q: string) {
    setQuery(q);
    setSelected(null);
    setExt(null);

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
        const res = await fetch(`/api/search-cards?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch { /* */ }
      setLoading(false);
    }, 120);
  }

  async function selectCard(card: CatalogCard) {
    setSelected(card);
    try {
      const res = await fetch(`/api/card-info?code=${encodeURIComponent(card.cardSetId)}`);
      if (res.ok) setExt(await res.json());
    } catch { /* */ }
  }

  return (
    <div>
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-bg pb-3 pt-1">
        <div className="flex items-center gap-2.5 bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => doSearch(e.target.value)}
            placeholder="Search card name or code..."
            enterKeyHint="search"
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-base text-text placeholder:text-text-dim"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setSelected(null); setExt(null); }} className="text-text-dim text-xs active:opacity-70">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected card detail */}
      {selected && (
        <div className="bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl mb-4 overflow-hidden">
          <div className="flex gap-4 p-4">
            <img
              src={selected.imageUrl}
              alt={selected.cardName}
              className="w-[100px] sm:w-[140px] rounded-lg aspect-[2.5/3.5] object-cover flex-none"
            />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-text-dim mb-1">{selected.cardSetId}</div>
              <h2 className="font-semibold text-base sm:text-lg text-text leading-tight mb-1">{selected.cardName}</h2>
              <div className="text-xs text-text-dim mb-3">{selected.setName}</div>

              {/* Price */}
              {selected.marketPrice != null && selected.marketPrice > 0 ? (
                <div className="font-mono font-semibold text-xl text-[#4ADE80]">
                  {fmt(selected.marketPrice)}
                </div>
              ) : (
                <div className="font-mono text-sm text-text-dim">No price data</div>
              )}

              {/* Stats */}
              {ext && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ext.card.type && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">{ext.card.type}</span>
                  )}
                  {ext.card.rarity && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">{ext.card.rarity}</span>
                  )}
                  {ext.card.color && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">{ext.card.color}</span>
                  )}
                  {ext.card.cost != null && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">Cost {ext.card.cost}</span>
                  )}
                  {ext.card.power != null && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">Power {ext.card.power}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Extended info */}
          {ext && (
            <div className="px-4 pb-4 space-y-3">
              {ext.card.traits && (
                <div className="text-xs text-text-muted">
                  <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Traits: </span>
                  {ext.card.traits}
                </div>
              )}
              {ext.card.effect && (
                <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">{ext.card.effect}</p>
              )}
              {ext.card.altArt && (
                <div className="text-[10px] text-yellow-400 font-mono">Alt art by {ext.card.altArt}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!selected && (
        <div>
          {loading && <div className="py-8 text-center text-text-dim text-sm animate-pulse">Searching...</div>}
          {!loading && results.length === 0 && query.length > 0 && (
            <div className="py-12 text-center text-text-dim text-sm">No cards found</div>
          )}
          {!loading && results.length === 0 && query.length === 0 && (
            <div className="py-12 text-center text-text-dim text-sm">
              Look up any card to see its market price and stats
            </div>
          )}

          {/* View toggle */}
          {results.length > 0 && (
            <div className="flex justify-end mb-2">
              <div className="flex border border-[rgba(255,255,255,0.06)] bg-bg-surface rounded-lg overflow-hidden">
                <button
                  onClick={() => setView("list")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === "list" ? "bg-[#27272A] text-text" : "text-text-muted"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setView("grid")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === "grid" ? "bg-[#27272A] text-text" : "text-text-muted"
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          )}

          {/* List view */}
          {view === "list" && results.map((card, i) => (
            <button
              key={card.cardSetId + i}
              onClick={() => selectCard(card)}
              className="flex items-center gap-3 w-full text-left border-b border-[rgba(255,255,255,0.04)] px-1 py-3 sm:py-2.5 active:opacity-80 transition-colors"
            >
              <div className="w-10 h-[56px] sm:w-8 sm:h-[44px] flex-none rounded-md overflow-hidden bg-[#1C1C1F]">
                <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                <span className="text-[11px] text-text-dim">{card.cardSetId} · {card.rarity}</span>
              </span>
              {card.marketPrice != null && card.marketPrice > 0 ? (
                <span className="font-mono text-sm font-semibold text-[#4ADE80] flex-none">{fmt(card.marketPrice)}</span>
              ) : (
                <span className="text-xs text-text-dim flex-none">—</span>
              )}
            </button>
          ))}

          {/* Grid view */}
          {view === "grid" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {results.map((card, i) => (
                <button
                  key={card.cardSetId + i}
                  onClick={() => selectCard(card)}
                  className="bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden active:opacity-80 transition-colors text-left"
                >
                  <div className="aspect-[2.5/3.5] bg-[#1C1C1F]">
                    <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-[9px] font-mono text-text-dim">{card.cardSetId}</div>
                    {card.marketPrice != null && card.marketPrice > 0 ? (
                      <div className="font-mono text-[11px] font-semibold text-[#4ADE80] mt-0.5">{fmt(card.marketPrice)}</div>
                    ) : (
                      <div className="text-[9px] text-text-dim mt-0.5">—</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
