"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";

type SortKey = "relevance" | "name" | "price";
type SortDir = "asc" | "desc";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir(key === "price" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (sortKey === "relevance") return results;
    return [...results].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.cardName.localeCompare(b.cardName);
      else if (sortKey === "price") cmp = (a.marketPrice ?? -1) - (b.marketPrice ?? -1);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [results, sortKey, sortDir]);

  function doSearch(q: string) {
    setQuery(q);
    setSelected(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => { // 80ms debounce
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search-cards?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch { /* */ }
      setLoading(false);
    }, 80);
  }

  function selectCard(card: CatalogCard) {
    setSelected(card);
  }

  return (
    <div className="page-slide-up">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-bg pb-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 transition-shadow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => doSearch(e.target.value)}
              placeholder="What are you looking for?"
              enterKeyHint="search"
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-base text-text placeholder:text-text-muted focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSelected(null); }} className="text-text-dim hover:text-text text-lg leading-none active:opacity-70">
                ×
              </button>
            )}
          </div>
          <button onClick={() => router.back()} className="text-text-muted text-sm font-medium hover:text-text active:opacity-70 flex-none">
            Close
          </button>
        </div>
      </div>

      {/* Card data sheet */}
      {selected && (
        <CardDataSheet
          key={selected.cardSetId}
          cardCode={selected.cardSetId}
          cardName={selected.cardName}
          imageUrl={selected.imageUrl}
          marketPrice={selected.marketPrice}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Results */}
      <div>
          {/* Sort + view when results exist */}
          {results.length > 0 && (
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {(["relevance", "name", "price"] as SortKey[]).map((k) => {
                const active = sortKey === k;
                const label = k === "relevance" ? "Best match" : k === "name" ? "Name" : "Price";
                return (
                  <button
                    key={k}
                    onClick={() => handleSort(k)}
                    className={`text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                      active ? "text-text font-semibold bg-bg-surface" : "text-text-dim hover:text-text"
                    }`}
                  >
                    {label} {active && k !== "relevance" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                );
              })}
              <div className="flex-1" />
              <div className="flex gap-0.5">
                <button onClick={() => setView("list")} className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "text-text bg-bg-surface" : "text-text-dim"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <button onClick={() => setView("grid")} className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "text-text bg-bg-surface" : "text-text-dim"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
              </div>
            </div>
          )}

          {loading && <div className="py-8 text-center text-text-dim text-sm animate-pulse">Searching...</div>}
          {!loading && results.length === 0 && query.length > 0 && (
            <div className="py-12 text-center text-text-dim text-sm">No cards found</div>
          )}
          {!loading && results.length === 0 && query.length === 0 && (
            <div className="py-20 text-center">
              <div className="text-text-dim text-base mb-2">Look up any card</div>
              <div className="text-sm text-text-muted">Search by name or set code to see market price and stats</div>
            </div>
          )}

          {/* View toggle */}
          {results.length > 0 && (
            <div className="flex justify-end mb-2">
              <div className="flex border border-[rgba(0,0,0,0.06)] bg-bg-surface rounded-lg overflow-hidden">
                <button
                  onClick={() => setView("list")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === "list" ? "bg-[#E4E4E7] text-text" : "text-text-muted"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setView("grid")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === "grid" ? "bg-[#E4E4E7] text-text" : "text-text-muted"
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          )}

          {/* List view */}
          {view === "list" && sorted.map((card, i) => (
            <button
              key={card.cardSetId + i}
              onClick={() => selectCard(card)}
              className="flex items-center gap-3 w-full text-left border-b border-[rgba(0,0,0,0.04)] px-1 py-3 sm:py-2.5 active:opacity-80 transition-colors"
            >
              <div className="w-10 h-[56px] sm:w-8 sm:h-[44px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
                <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                <span className="text-xs text-text-dim">{card.cardSetId} · {card.rarity}</span>
              </span>
              {card.marketPrice != null && card.marketPrice > 0 ? (
                <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{fmt(card.marketPrice)}</span>
              ) : (
                <span className="text-xs text-text-dim flex-none">—</span>
              )}
            </button>
          ))}

          {/* Grid view */}
          {view === "grid" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {sorted.map((card, i) => (
                <button
                  key={card.cardSetId + i}
                  onClick={() => selectCard(card)}
                  className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden active:opacity-80 transition-colors text-left"
                >
                  <div className="aspect-[2.5/3.5] bg-[#E4E4E7]">
                    <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-xs font-mono text-text-dim">{card.cardSetId}</div>
                    {card.marketPrice != null && card.marketPrice > 0 ? (
                      <div className="font-mono text-xs font-semibold text-[#059669] mt-0.5">{fmt(card.marketPrice)}</div>
                    ) : (
                      <div className="text-xs text-text-dim mt-0.5">—</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
