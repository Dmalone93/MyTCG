"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useRegion } from "@/components/region-selector";

/* ── Types ── */
type FilterKey = "set" | "color" | "rarity" | "type";
type SortKey = "code" | "name" | "price";
type SortDir = "asc" | "desc";

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

const COLOR_DOT: Record<string, string> = {
  Red: "#DC2626", Blue: "#2563EB", Green: "#16A34A",
  Purple: "#9333EA", Black: "#18181B", Yellow: "#CA8A04",
};

const RARITY_ORDER: Record<string, number> = {
  SEC: 0, SP: 1, SR: 3, L: 4, R: 5, UC: 6, C: 7,
};

export function CardPicker({
  onPick,
  onPickMultiple,
  onCancel,
}: {
  onPick: (card: CatalogCard) => void;
  onPickMultiple?: (cards: CatalogCard[]) => void;
  onCancel: () => void;
}) {
  const { formatPrice } = useRegion();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Data
  const [allCards, setAllCards] = useState<CatalogCard[]>([]);
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Search + filters
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ set: null, color: null, rarity: null, type: null });
  const [openPicker, setOpenPicker] = useState<FilterKey | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drag-to-select (mobile)
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const lastToggled = useRef<string | null>(null);

  // Load all cards
  useEffect(() => {
    fetch("/api/browse-cards")
      .then((r) => r.json())
      .then((data) => {
        setAllCards(data.cards ?? []);
        setFilterMeta(data.filters ?? null);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Filter + search
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasInput = query.length > 0 || activeFilterCount > 0;

  const filtered = useMemo(() => {
    if (!hasInput) return [];
    let arr = allCards;
    if (filters.set) arr = arr.filter((c) => c.setId === filters.set);
    if (filters.color) arr = arr.filter((c) => c.cardColor?.toLowerCase().includes(filters.color!.toLowerCase()));
    if (filters.rarity) arr = arr.filter((c) => c.rarity?.toUpperCase() === filters.rarity!.toUpperCase());
    if (filters.type) arr = arr.filter((c) => c.cardType?.toLowerCase() === filters.type!.toLowerCase());
    if (query.trim().length > 0) {
      const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
      arr = arr.filter((c) => {
        const h = (c.cardName + c.cardSetId).toLowerCase().replace(/[^a-z0-9]/g, "");
        return h.includes(q);
      });
    }
    return arr;
  }, [allCards, filters, query, hasInput]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "code": {
          cmp = (a.setId || "").localeCompare(b.setId || "");
          if (cmp === 0) cmp = parseInt(a.cardSetId.replace(/\D/g, "") || "0") - parseInt(b.cardSetId.replace(/\D/g, "") || "0");
          break;
        }
        case "name": cmp = a.cardName.localeCompare(b.cardName); break;
        case "price": cmp = (a.marketPrice ?? -1) - (b.marketPrice ?? -1); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const MAX_DISPLAY = 150;
  const displayed = sorted.slice(0, MAX_DISPLAY);

  // Filter helpers
  function setFilter(key: FilterKey, value: string | null) {
    setFilters((p) => ({ ...p, [key]: value }));
    setOpenPicker(null);
  }

  function togglePicker(key: FilterKey) {
    setOpenPicker((p) => p === key ? null : key);
  }

  function filterLabel(key: FilterKey): string {
    const v = filters[key];
    if (!v) return key === "set" ? "Set" : key === "color" ? "Color" : key === "rarity" ? "Rarity" : "Type";
    if (key === "set") return filterMeta?.sets.find((s) => s.id === v)?.id ?? v;
    return v;
  }

  function pickerOptions(key: FilterKey): { value: string; label: string; sub?: string }[] {
    if (!filterMeta) return [];
    switch (key) {
      case "set": return filterMeta.sets.map((s) => ({ value: s.id, label: s.id, sub: s.name }));
      case "color": return filterMeta.colors.map((c) => ({ value: c, label: c }));
      case "rarity": return [...filterMeta.rarities].sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99)).map((r) => ({ value: r, label: r }));
      case "type": return filterMeta.types.map((t) => ({ value: t, label: t }));
    }
  }

  const sortKeyRef = useRef(sortKey);
  sortKeyRef.current = sortKey;

  function handleSort(key: SortKey) {
    if (sortKeyRef.current === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "desc" : "asc");
    }
  }

  // Selection
  function toggleCard(cardId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }

  function addSelected() {
    if (!onPickMultiple || selected.size === 0) return;
    const cards = allCards.filter((c) => selected.has(c.cardSetId));
    onPickMultiple(cards);
    setSelected(new Set());
  }

  // Drag-to-select handlers (long press then drag)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCardId = useRef<string | null>(null);

  function handlePointerDown(cardId: string) {
    dragCardId.current = cardId;
    // Start long press timer — 300ms to enter drag mode
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      lastToggled.current = cardId;
      // Add this card to selection
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    }, 300);
  }

  function handlePointerMove() {
    // If moved before long press fires, cancel it (user is scrolling)
    if (!isDragging.current && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerEnterCard(cardId: string) {
    if (!isDragging.current) return;
    if (lastToggled.current === cardId) return;
    lastToggled.current = cardId;
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    isDragging.current = false;
    lastToggled.current = null;
    dragCardId.current = null;
  }

  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  return (
    <div className="fixed inset-0 z-50 sm:relative sm:inset-auto" onClick={onCancel}>
      <div className="absolute inset-0 bg-white/60 sm:hidden" />

      <div
        className="absolute inset-0 sm:relative flex flex-col bg-bg-elevated sm:border sm:border-[rgba(0,0,0,0.06)] sm:rounded-2xl sm:mb-3 sm:max-h-[70vh] sm:overflow-hidden sm:shadow-[0_14px_40px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
        onPointerUp={handlePointerUp}
      >
        {/* Header */}
        <div className="flex-none bg-bg-elevated px-4 pt-3 pb-2">
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 flex items-center gap-2.5 bg-bg-surface rounded-xl px-3 py-2.5 border border-[rgba(0,0,0,0.06)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards..."
                enterKeyHint="search"
                className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-dim"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-text-dim hover:text-text text-base leading-none">×</button>
              )}
            </div>
            <button onClick={onCancel} className="text-text-muted text-sm font-medium hover:text-text active:opacity-70 flex-none">
              Close
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["set", "color", "rarity", "type"] as FilterKey[]).map((key) => {
              const isActive = filters[key] !== null;
              return (
                <button
                  key={key}
                  onClick={() => togglePicker(key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg whitespace-nowrap transition-all flex-none ${
                    isActive ? "bg-text text-bg font-medium" : "bg-bg-surface text-text-dim hover:text-text"
                  }`}
                >
                  {key === "color" && isActive && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_DOT[filters[key]!] ?? "#999" }} />
                  )}
                  {filterLabel(key)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              );
            })}
          </div>

          {/* Inline picker */}
          {openPicker && filterMeta && (
            <div className="mt-2 bg-white rounded-xl shadow-lg border border-[rgba(0,0,0,0.08)] max-h-[40vh] overflow-y-auto">
              <button
                onClick={() => setFilter(openPicker, null)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-bg-surface ${!filters[openPicker] ? "font-medium text-text" : "text-text-dim"}`}
              >
                All {openPicker === "set" ? "Sets" : openPicker === "color" ? "Colors" : openPicker === "rarity" ? "Rarities" : "Types"}
              </button>
              <div className="border-t border-[rgba(0,0,0,0.04)]" />
              {openPicker === "color" ? (
                <div className="grid grid-cols-3 gap-1 p-2">
                  {pickerOptions("color").map((o) => (
                    <button key={o.value} onClick={() => setFilter("color", o.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${filters.color === o.value ? "bg-bg-surface font-medium text-text" : "text-text-dim hover:bg-bg-surface"}`}>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_DOT[o.value] ?? "#999" }} />{o.label}
                    </button>
                  ))}
                </div>
              ) : openPicker === "set" ? (
                <div className="py-1">
                  {pickerOptions("set").map((o) => (
                    <button key={o.value} onClick={() => setFilter("set", o.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-bg-surface flex items-center gap-3 ${filters.set === o.value ? "font-medium text-text bg-bg-surface" : "text-text"}`}>
                      <span className="font-mono text-text-dim text-xs w-12 flex-none">{o.label}</span>
                      <span className="truncate">{o.sub}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 p-2">
                  {pickerOptions(openPicker).map((o) => (
                    <button key={o.value} onClick={() => setFilter(openPicker!, o.value)}
                      className={`px-3 py-2 rounded-lg text-sm text-left ${filters[openPicker!] === o.value ? "bg-bg-surface font-medium text-text" : "text-text-dim hover:bg-bg-surface"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sort bar */}
        {filtered.length > 0 && (
          <div className="flex-none flex items-center gap-1 px-4 py-2 border-t border-b border-[rgba(0,0,0,0.04)] bg-bg">
            <span className="text-xs text-text-dim font-mono mr-1">{sorted.length}</span>
            <div className="w-px h-3 bg-[rgba(0,0,0,0.1)]" />
            {(["code", "name", "price"] as SortKey[]).map((k) => {
              const active = sortKey === k;
              return (
                <button key={k} onClick={(e) => { e.stopPropagation(); handleSort(k); }}
                  className={`text-xs px-2 py-1 rounded-md ${active ? "text-text font-semibold bg-bg-surface" : "text-text-dim hover:text-text"}`}>
                  {k === "code" ? "Code" : k === "name" ? "Name" : "Price"} {active && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              );
            })}
            {selected.size > 0 && (
              <>
                <div className="flex-1" />
                <button onClick={() => setSelected(new Set())} className="text-xs text-text-dim hover:text-text px-1">Clear</button>
              </>
            )}
          </div>
        )}

        {/* Card list */}
        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
          {dataLoading && <div className="py-12 text-center text-text-dim text-sm animate-pulse">Loading cards...</div>}

          {!dataLoading && !hasInput && (
            <div className="py-16 text-center px-8">
              <div className="text-text-dim text-sm mb-1">Search or filter to find cards</div>
              <div className="text-xs text-text-muted">Hold and drag to select multiple</div>
            </div>
          )}

          {!dataLoading && hasInput && filtered.length === 0 && (
            <div className="py-12 text-center text-text-dim text-sm">No cards match</div>
          )}

          {displayed.map((card) => {
            const isSelected = selected.has(card.cardSetId);
            return (
              <div
                key={card.cardSetId}
                className={`flex items-center gap-3 w-full text-left border-b border-[rgba(0,0,0,0.04)] px-4 py-3 sm:py-2.5 cursor-pointer transition-colors select-none ${
                  isSelected ? "bg-accent/10" : "active:bg-[rgba(0,0,0,0.02)]"
                }`}
                onClick={() => {
                  if (!isDragging.current) toggleCard(card.cardSetId);
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") handlePointerDown(card.cardSetId);
                }}
                onPointerMove={handlePointerMove}
                onPointerEnter={() => handlePointerEnterCard(card.cardSetId)}
              >
                {/* Checkbox — always visible */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-none transition-colors ${
                  isSelected ? "bg-accent border-accent" : "border-[rgba(0,0,0,0.15)]"
                }`}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                <div className="w-9 h-[50px] sm:w-7 sm:h-[38px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
                  <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                  <span className="text-xs text-text-dim">{card.cardSetId} · {card.rarity}{card.cardColor ? ` · ${card.cardColor}` : ""}</span>
                </span>
                {card.marketPrice != null && card.marketPrice > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#059669] flex-none">
                    {formatPrice(card.marketPrice)}
                  </span>
                )}
              </div>
            );
          })}

          {sorted.length > MAX_DISPLAY && (
            <div className="py-4 text-center text-xs text-text-dim">
              Showing {MAX_DISPLAY} of {sorted.length} — narrow your filters
            </div>
          )}
        </div>

        {/* Confirm bar — sticky at bottom when cards are selected */}
        {selected.size > 0 && onPickMultiple && (
          <div className="flex-none flex items-center gap-3 px-4 py-3 bg-bg-elevated border-t border-[rgba(0,0,0,0.08)] safe-area-pb">
            <span className="text-sm text-text-muted">
              {selected.size} card{selected.size !== 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm text-text-dim hover:text-text active:opacity-70 px-3 py-2"
            >
              Clear
            </button>
            <button
              onClick={addSelected}
              className="bg-text text-bg font-medium text-sm py-2.5 px-5 rounded-xl active:opacity-80 transition-colors"
            >
              Add {selected.size} card{selected.size !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
