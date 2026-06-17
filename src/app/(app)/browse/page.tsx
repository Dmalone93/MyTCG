"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";
import { useRegion } from "@/components/region-selector";

/* ── Types ── */
type SortKey = "code" | "name" | "price";
type SortDir = "asc" | "desc";
type FilterKey = "set" | "color" | "rarity" | "type";

type Filters = {
  set: string | null;
  color: string | null;
  rarity: string | null;
  type: string | null;
};

type FilterMeta = {
  sets: { id: string; name: string }[];
  colors: string[];
  rarities: string[];
  types: string[];
};

/* ── Color dot map ── */
const COLOR_DOT: Record<string, string> = {
  Red: "#DC2626",
  Blue: "#2563EB",
  Green: "#16A34A",
  Purple: "#9333EA",
  Black: "#18181B",
  Yellow: "#CA8A04",
};

/* ── Rarity sort order ── */
const RARITY_ORDER: Record<string, number> = {
  SEC: 0, SP: 1, "SEC-P": 2, SR: 3, L: 4, R: 5, UC: 6, C: 7,
};

export default function BrowsePage() {
  const { formatPrice } = useRegion();

  // All cards + filter options
  const [allCards, setAllCards] = useState<CatalogCard[]>([]);
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const dataLoadedRef = useRef(false);

  // Filter state
  const [filters, setFilters] = useState<Filters>({ set: null, color: null, rarity: null, type: null });
  const [openPicker, setOpenPicker] = useState<FilterKey | null>(null);

  // Display state
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Load all cards on mount
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    fetch("/api/browse-cards")
      .then((r) => r.json())
      .then((data) => {
        setAllCards(data.cards ?? []);
        const meta = data.filters ?? null;
        setFilterMeta(meta);
        // Auto-select the latest OP-XX booster set
        if (meta?.sets?.length > 0) {
          const opSets = meta.sets
            .filter((s: { id: string }) => /^OP-\d+$/i.test(s.id))
            .sort((a: { id: string }, b: { id: string }) => {
              const numA = parseInt(a.id.match(/\d+/)?.[0] ?? "0");
              const numB = parseInt(b.id.match(/\d+/)?.[0] ?? "0");
              return numB - numA;
            });
          if (opSets.length > 0) {
            setFilters((prev) => ({ ...prev, set: opSets[0].id }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Filter
  const filtered = useMemo(() => {
    if (activeFilterCount === 0) return [];

    let arr = allCards;
    if (filters.set) arr = arr.filter((c) => c.setId === filters.set);
    if (filters.color) arr = arr.filter((c) => c.cardColor?.toLowerCase().includes(filters.color!.toLowerCase()));
    if (filters.rarity) arr = arr.filter((c) => c.rarity?.toUpperCase() === filters.rarity!.toUpperCase());
    if (filters.type) arr = arr.filter((c) => c.cardType?.toLowerCase() === filters.type!.toLowerCase());
    return arr;
  }, [allCards, filters, activeFilterCount]);

  // Sort
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "desc" : "asc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "code": {
          const setA = a.setId || "";
          const setB = b.setId || "";
          cmp = setA.localeCompare(setB);
          if (cmp === 0) {
            const numA = parseInt(a.cardSetId.replace(/\D/g, "") || "0");
            const numB = parseInt(b.cardSetId.replace(/\D/g, "") || "0");
            cmp = numA - numB;
          }
          break;
        }
        case "name":
          cmp = a.cardName.localeCompare(b.cardName);
          break;
        case "price":
          cmp = (a.marketPrice ?? -1) - (b.marketPrice ?? -1);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Filter helpers
  function setFilter(key: FilterKey, value: string | null) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOpenPicker(null);
  }

  function clearFilter(key: FilterKey) {
    setFilters((prev) => ({ ...prev, [key]: null }));
  }

  function togglePicker(key: FilterKey) {
    setOpenPicker((prev) => prev === key ? null : key);
  }

  function filterLabel(key: FilterKey): string {
    const v = filters[key];
    if (!v) return key === "set" ? "Set" : key === "color" ? "Color" : key === "rarity" ? "Rarity" : "Type";
    if (key === "set") {
      const s = filterMeta?.sets.find((s) => s.id === v);
      return s ? s.id : v;
    }
    return v;
  }

  function pickerOptions(key: FilterKey): { value: string; label: string; sub?: string }[] {
    if (!filterMeta) return [];
    switch (key) {
      case "set":
        return filterMeta.sets.map((s) => ({ value: s.id, label: s.id, sub: s.name }));
      case "color":
        return filterMeta.colors.map((c) => ({ value: c, label: c }));
      case "rarity":
        return [...filterMeta.rarities].sort((a, b) =>
          (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99)
        ).map((r) => ({ value: r, label: r }));
      case "type":
        return filterMeta.types.map((t) => ({ value: t, label: t }));
    }
  }

  const MAX_DISPLAY = 200;
  const displayed = sorted.slice(0, MAX_DISPLAY);
  const hasMore = sorted.length > MAX_DISPLAY;

  return (
    <div>
      {/* ── Sticky header: title + filters ── */}
      <div className="sticky top-0 z-10 bg-bg pb-3 pt-1">
        <h1 className="text-lg font-bold text-text mb-4">Browse</h1>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["set", "color", "rarity", "type"] as FilterKey[]).map((key) => {
            const isActive = filters[key] !== null;
            const label = filterLabel(key);
            return (
              <button
                key={key}
                onClick={() => togglePicker(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl whitespace-nowrap transition-all flex-none ${
                  isActive
                    ? "bg-text text-bg font-medium"
                    : "bg-bg-surface text-text-dim hover:text-text border border-transparent"
                }`}
              >
                {key === "color" && isActive && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ backgroundColor: COLOR_DOT[filters[key]!] ?? "#999" }}
                  />
                )}
                {label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-none opacity-50">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {(["set", "color", "rarity", "type"] as FilterKey[]).map((key) => {
              const v = filters[key];
              if (!v) return null;
              const label = key === "set"
                ? filterMeta?.sets.find((s) => s.id === v)?.name ?? v
                : v;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-surface rounded-lg text-xs font-medium text-text"
                >
                  {key === "color" && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_DOT[v] ?? "#999" }} />
                  )}
                  <span className="text-text-dim uppercase tracking-wider text-[10px]">{key}</span>
                  {label}
                  <button onClick={() => clearFilter(key)} className="ml-0.5 text-text-dim hover:text-text">×</button>
                </span>
              );
            })}
          </div>
        )}

        {/* Inline picker */}
        {openPicker && filterMeta && (
          <div className="mt-2 bg-white rounded-2xl shadow-lg border border-[rgba(0,0,0,0.08)] max-h-[60vh] overflow-y-auto">
            <button
              onClick={() => setFilter(openPicker, null)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-surface ${
                !filters[openPicker] ? "font-medium text-text" : "text-text-dim"
              }`}
            >
              All {openPicker === "set" ? "Sets" : openPicker === "color" ? "Colors" : openPicker === "rarity" ? "Rarities" : "Types"}
            </button>
            <div className="border-t border-[rgba(0,0,0,0.04)]" />
            {openPicker === "color" ? (
              <div className="grid grid-cols-3 gap-1 p-2">
                {pickerOptions("color").map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter("color", opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      filters.color === opt.value ? "bg-bg-surface font-medium text-text" : "text-text-dim hover:bg-bg-surface"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-none" style={{ backgroundColor: COLOR_DOT[opt.value] ?? "#999" }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : openPicker === "set" ? (
              <div className="py-1">
                {pickerOptions("set").map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter("set", opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-surface flex items-center gap-3 ${
                      filters.set === opt.value ? "font-medium text-text bg-bg-surface" : "text-text"
                    }`}
                  >
                    <span className="font-mono text-text-dim text-xs w-12 flex-none">{opt.label}</span>
                    <span className="truncate">{opt.sub}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 p-2">
                {pickerOptions(openPicker).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(openPicker!, opt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                      filters[openPicker!] === opt.value ? "bg-bg-surface font-medium text-text" : "text-text-dim hover:bg-bg-surface"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card detail */}
      {selectedCard && (
        <CardDataSheet
          key={selectedCard.cardSetId}
          cardCode={selectedCard.cardSetId}
          cardName={selectedCard.cardName}
          imageUrl={selectedCard.imageUrl}
          marketPrice={selectedCard.marketPrice}
          rarity={selectedCard.rarity}
          cardColor={selectedCard.cardColor}
          cardType={selectedCard.cardType}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* ── Results ── */}
      {dataLoading && (
        <div className="py-12 text-center text-text-dim text-sm animate-pulse">Loading cards...</div>
      )}

      {!dataLoading && activeFilterCount === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-dim text-base mb-2">Browse all cards</div>
          <div className="text-sm text-text-muted max-w-[280px] mx-auto">
            Pick a set, color, rarity, or type to start exploring
          </div>
        </div>
      )}

      {!dataLoading && activeFilterCount > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-text-dim text-sm">No cards match your filters</div>
      )}

      {!dataLoading && filtered.length > 0 && (
        <div className="mt-2">
          {/* Results count + sort + view */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <span className="text-xs text-text-dim font-mono mr-1">
              {sorted.length} card{sorted.length !== 1 ? "s" : ""}
            </span>
            <div className="w-px h-3.5 bg-[rgba(0,0,0,0.1)]" />
            {(["code", "name", "price"] as SortKey[]).map((k) => {
              const active = sortKey === k;
              const label = k === "code" ? "Code" : k === "name" ? "Name" : "Price";
              return (
                <button
                  key={k}
                  onClick={() => handleSort(k)}
                  className={`text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                    active ? "text-text font-semibold bg-bg-surface" : "text-text-dim hover:text-text"
                  }`}
                >
                  {label} {active && (sortDir === "asc" ? "↑" : "↓")}
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

          {/* List view */}
          {view === "list" && (
            <div>
              {displayed.map((card, i) => (
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
            </div>
          )}

          {/* Grid view */}
          {view === "grid" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {displayed.map((card, i) => (
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

          {hasMore && (
            <div className="py-6 text-center text-sm text-text-dim">
              Showing {MAX_DISPLAY} of {sorted.length} results — narrow your filters to see more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
