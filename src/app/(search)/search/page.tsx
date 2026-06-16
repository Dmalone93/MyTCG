"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";
import { useRegion } from "@/components/region-selector";

type Tab = "search" | "browse";
type SortKey = "relevance" | "code" | "name" | "price";
type SortDir = "asc" | "desc";

type CardSet = { name: string; id?: string; count: number; date: string | null };

function categoriseSet(s: CardSet): string {
  const id = s.id ?? "";
  const name = s.name;
  if (/^OP-?\d/i.test(id) || /^OP\d/i.test(id)) return "Booster Packs";
  if (/^ST-?\d/i.test(id)) return "Starter Decks";
  if (/^EB-?\d/i.test(id) || /Extra Booster/i.test(name)) return "Extra Boosters";
  if (/^PRB/i.test(id) || /Premium Booster/i.test(name)) return "Premium Boosters";
  if (/Promo/i.test(name) || id === "P") return "Promos";
  if (/^OP\d+-EB/i.test(id)) return "Booster Packs";
  return "Other";
}

const GROUP_ORDER = ["Booster Packs", "Extra Boosters", "Premium Boosters", "Starter Decks", "Promos", "Other"];

const COLORS = [
  { name: "Red", color: "#DC2626" },
  { name: "Blue", color: "#2563EB" },
  { name: "Green", color: "#16A34A" },
  { name: "Purple", color: "#9333EA" },
  { name: "Black", color: "#18181B" },
  { name: "Yellow", color: "#CA8A04" },
];

export default function SearchPage() {
  const router = useRouter();
  const { formatPrice } = useRegion();

  // Tab state
  const [tab, setTab] = useState<Tab>("search");

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Browse state
  const [sets, setSets] = useState<CardSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [selectedSet, setSelectedSet] = useState<CardSet | null>(null);
  const [setCards, setSetCards] = useState<CatalogCard[]>([]);
  const [setCardsLoading, setSetCardsLoading] = useState(false);
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  // Shared state
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Load sets when browse tab is first activated
  const setsLoadedRef = useRef(false);
  useEffect(() => {
    if (tab === "browse" && !setsLoadedRef.current) {
      setsLoadedRef.current = true;
      setSetsLoading(true);
      fetch("/api/card-sets")
        .then((r) => r.json())
        .then((data) => setSets(data))
        .catch(() => {})
        .finally(() => setSetsLoading(false));
    }
  }, [tab]);

  // Focus input when switching to search tab
  useEffect(() => {
    if (tab === "search") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [tab]);

  // Search
  function doSearch(q: string) {
    setQuery(q);
    setSelectedCard(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search-cards?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        if (res.ok) setSearchResults(await res.json());
      } catch { /* aborted */ }
      setSearchLoading(false);
    }, 80);
  }

  // Browse — load a set
  const loadSet = useCallback(async (s: CardSet) => {
    setSelectedSet(s);
    setSetCardsLoading(true);
    setColorFilter(null);
    setSortKey("code");
    setSortDir("asc");
    try {
      const res = await fetch(`/api/card-sets?set=${encodeURIComponent(s.id ?? s.name)}`);
      setSetCards(await res.json());
    } catch { /* */ }
    setSetCardsLoading(false);
  }, []);

  // Sort
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir(key === "price" ? "desc" : "asc");
      return key;
    });
  }, []);

  // Active cards based on tab
  const activeCards = tab === "search" ? searchResults : setCards;
  const activeLoading = tab === "search" ? searchLoading : setCardsLoading;
  const activeSortKeys: SortKey[] = tab === "search" ? ["relevance", "name", "price"] : ["code", "name", "price"];

  const sorted = useMemo(() => {
    let arr = [...activeCards];
    if (tab === "browse" && colorFilter) {
      arr = arr.filter((c) => c.cardColor?.toLowerCase().includes(colorFilter.toLowerCase()));
    }
    if (sortKey === "relevance") return arr;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "code": {
          const numA = parseInt(a.cardSetId.replace(/\D/g, "") || "0");
          const numB = parseInt(b.cardSetId.replace(/\D/g, "") || "0");
          cmp = numA - numB;
          break;
        }
        case "name":
          cmp = a.cardName.localeCompare(b.cardName);
          break;
        case "price": {
          const pA = a.marketPrice ?? -1;
          const pB = b.marketPrice ?? -1;
          cmp = pA - pB;
          break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [activeCards, sortKey, sortDir, colorFilter, tab]);

  const groupedSets = useMemo(() => {
    const groups = new Map<string, CardSet[]>();
    for (const s of sets) {
      const group = categoriseSet(s);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(s);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      group: g,
      sets: groups.get(g)!.sort((a, b) => {
        const numA = parseInt(((a.id ?? a.name).match(/(\d+)/)?.[1]) ?? "999");
        const numB = parseInt(((b.id ?? b.name).match(/(\d+)/)?.[1]) ?? "999");
        return numA - numB;
      }),
    }));
  }, [sets]);

  // Switch tab
  function switchTab(t: Tab) {
    setTab(t);
    setSelectedCard(null);
    if (t === "search") {
      setSortKey("relevance");
      setSortDir("asc");
    } else {
      setSortKey("code");
      setSortDir("asc");
    }
  }

  const showCards = tab === "search" ? (searchResults.length > 0) : (selectedSet !== null);

  return (
    <div className="page-slide-up">
      {/* Search bar + close */}
      <div className="sticky top-0 z-10 bg-bg pb-2 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 transition-shadow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { doSearch(e.target.value); if (tab !== "search") switchTab("search"); }}
              onFocus={() => { if (tab !== "search") switchTab("search"); }}
              placeholder="What are you looking for?"
              enterKeyHint="search"
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-muted focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setSearchResults([]); setSelectedCard(null); }} className="text-text-dim hover:text-text text-lg leading-none active:opacity-70">
                ×
              </button>
            )}
          </div>
          <button onClick={() => router.back()} className="text-text-muted text-sm font-medium hover:text-text active:opacity-70 flex-none">
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-3 border-b border-[rgba(0,0,0,0.06)]">
          <button
            onClick={() => switchTab("search")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              tab === "search" ? "text-text" : "text-text-dim hover:text-text"
            }`}
          >
            Search
            {tab === "search" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
          </button>
          <button
            onClick={() => switchTab("browse")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              tab === "browse" ? "text-text" : "text-text-dim hover:text-text"
            }`}
          >
            Browse
            {tab === "browse" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
          </button>
        </div>
      </div>

      {/* Card data sheet */}
      {selectedCard && (
        <CardDataSheet
          key={selectedCard.cardSetId}
          cardCode={selectedCard.cardSetId}
          cardName={selectedCard.cardName}
          imageUrl={selectedCard.imageUrl}
          marketPrice={selectedCard.marketPrice}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* ─── SEARCH TAB ─── */}
      {tab === "search" && (
        <div className="mt-3">
          {searchLoading && <div className="py-8 text-center text-text-dim text-sm animate-pulse">Searching...</div>}
          {!searchLoading && searchResults.length === 0 && query.length > 0 && (
            <div className="py-12 text-center text-text-dim text-sm">No cards found</div>
          )}
          {!searchLoading && searchResults.length === 0 && query.length === 0 && (
            <div className="py-20 text-center">
              <div className="text-text-dim text-base mb-2">Look up any card</div>
              <div className="text-sm text-text-muted">Search by name or set code to see market price and stats</div>
            </div>
          )}
        </div>
      )}

      {/* ─── BROWSE TAB — set list ─── */}
      {tab === "browse" && !selectedSet && (
        <div className="mt-3">
          {setsLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-bg-surface rounded-2xl animate-pulse" />
              ))}
            </div>
          )}
          {groupedSets.map(({ group, sets: groupSets }) => (
            <div key={group} className="mb-6">
              <div className="text-sm font-bold text-text uppercase tracking-wide mb-2 pb-1.5 border-b border-[rgba(0,0,0,0.08)]">
                {group}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {groupSets.map((s) => (
                  <button
                    key={s.id ?? s.name}
                    onClick={() => loadSet(s)}
                    className="flex flex-col text-left px-3 py-2.5 rounded-2xl bg-bg-surface hover:bg-[rgba(0,0,0,0.04)] active:opacity-80 transition-colors"
                  >
                    <div className="text-sm font-medium text-text truncate">{s.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.id && <span className="text-xs text-text-dim">{s.id}</span>}
                      <span className="text-xs text-text-dim font-mono ml-auto">{s.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── BROWSE TAB — set header + quick switcher ─── */}
      {tab === "browse" && selectedSet && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setSelectedSet(null); setSetCards([]); }} className="text-sm text-text-muted hover:text-text active:opacity-70">
              ← Sets
            </button>
            <h2 className="text-base font-bold text-text flex-1 truncate">{selectedSet.name}</h2>
            <span className="text-sm text-text-dim font-mono">{setCards.length}</span>
          </div>

          {/* Quick set switcher */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
            {sets
              .filter((s) => categoriseSet(s) === categoriseSet(selectedSet))
              .sort((a, b) => {
                const numA = parseInt(((a.id ?? a.name).match(/(\d+)/)?.[1]) ?? "999");
                const numB = parseInt(((b.id ?? b.name).match(/(\d+)/)?.[1]) ?? "999");
                return numA - numB;
              })
              .map((s) => (
                <button
                  key={s.id ?? s.name}
                  onClick={() => loadSet(s)}
                  className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors flex-none ${
                    (s.id ?? s.name) === (selectedSet.id ?? selectedSet.name)
                      ? "bg-text text-bg font-semibold"
                      : "text-text-dim hover:text-text bg-bg-surface"
                  }`}
                >
                  {s.id ?? s.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* ─── SHARED: cards toolbar + list/grid ─── */}
      {showCards && (
        <div>
          {/* Color filter (browse only) */}
          {tab === "browse" && selectedSet && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setColorFilter(null)}
                className={`px-2.5 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  !colorFilter ? "bg-text text-bg font-semibold" : "text-text-dim hover:text-text"
                }`}
              >
                All
              </button>
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColorFilter(colorFilter === c.name ? null : c.name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                    colorFilter === c.name ? "bg-bg-surface font-semibold text-text" : "text-text-dim hover:text-text"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Sort + view controls */}
          <div className="flex items-center gap-1.5 mb-5 flex-wrap">
            {activeSortKeys.map((k) => {
              const active = sortKey === k;
              const label = k === "relevance" ? "Best match" : k === "code" ? "Code" : k === "name" ? "Name" : "Price";
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

          {/* Loading */}
          {activeLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-bg-surface rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {/* List view */}
          {!activeLoading && view === "list" && sorted.map((card, i) => (
            <button
              key={card.cardSetId + i}
              onClick={() => setSelectedCard(card)}
              className="flex items-center gap-3 w-full text-left border-b border-[rgba(0,0,0,0.04)] px-1 py-3 sm:py-2.5 active:opacity-80 transition-colors"
            >
              <div className="w-10 h-[56px] sm:w-8 sm:h-[44px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
                <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                <span className="text-xs text-text-dim">{card.cardSetId} · {card.rarity}{card.cardColor ? ` · ${card.cardColor}` : ""}</span>
              </span>
              {card.marketPrice != null && card.marketPrice > 0 ? (
                <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(card.marketPrice)}</span>
              ) : (
                <span className="text-xs text-text-dim flex-none">—</span>
              )}
            </button>
          ))}

          {/* Grid view */}
          {!activeLoading && view === "grid" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {sorted.map((card, i) => (
                <button
                  key={card.cardSetId + i}
                  onClick={() => setSelectedCard(card)}
                  className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden active:opacity-80 transition-colors text-left"
                >
                  <div className="aspect-[2.5/3.5] bg-[#E4E4E7]">
                    <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-xs font-mono text-text-dim mt-0.5">{card.cardSetId}</div>
                    {card.marketPrice != null && card.marketPrice > 0 ? (
                      <div className="font-mono text-xs font-semibold text-[#059669] mt-1">{formatPrice(card.marketPrice)}</div>
                    ) : (
                      <div className="text-xs text-text-dim mt-1">—</div>
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
