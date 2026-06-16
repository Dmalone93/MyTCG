"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";
import { useRegion } from "@/components/region-selector";

type CardSet = { name: string; id?: string; count: number; date: string | null };
type SortKey = "code" | "name" | "price";
type SortDir = "asc" | "desc";

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

export default function BrowsePage() {
  const [sets, setSets] = useState<CardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<CardSet | null>(null);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const { formatPrice } = useRegion();

  useEffect(() => {
    fetch("/api/card-sets")
      .then((r) => r.json())
      .then((data) => setSets(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadSet = useCallback(async (s: CardSet) => {
    setSelectedSet(s);
    setLoadingCards(true);
    setColorFilter(null);
    try {
      const res = await fetch(`/api/card-sets?set=${encodeURIComponent(s.id ?? s.name)}`);
      setCards(await res.json());
    } catch { /* */ }
    setLoadingCards(false);
  }, []);

  // Sort with explicit key + direction as a single state update
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => d === "asc" ? "desc" : "asc");
        return key;
      }
      setSortDir(key === "price" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    let arr = [...cards];
    if (colorFilter) {
      arr = arr.filter((c) => c.cardColor?.toLowerCase().includes(colorFilter.toLowerCase()));
    }
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
  }, [cards, sortKey, sortDir, colorFilter]);

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

  return (
    <div>
      {/* Set selector — always visible as a horizontal strip */}
      <div className="mb-4">
        {!selectedSet && <h1 className="text-lg font-bold text-text mb-4">Browse All Cards</h1>}

        {selectedSet && (
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => { setSelectedSet(null); setCards([]); }} className="text-sm text-text-muted hover:text-text active:opacity-70">
              ← Sets
            </button>
            <h1 className="text-base font-bold text-text flex-1 truncate">{selectedSet.name}</h1>
            <span className="text-sm text-text-dim font-mono">{cards.length}</span>
          </div>
        )}

        {/* Quick set switcher — horizontal scroll of sets in same group */}
        {selectedSet && (
          <div className="flex gap-1 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
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
        )}
      </div>

      {/* Set list */}
      {!selectedSet && (
        <>
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-bg-surface rounded-xl animate-pulse" />
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
                    className="flex flex-col text-left px-3 py-2.5 rounded-xl bg-bg-surface hover:bg-[rgba(0,0,0,0.04)] active:opacity-80 transition-colors"
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
        </>
      )}

      {/* Cards in set */}
      {selectedSet && (
        <>
          {/* Color filter */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5">
            <button
              onClick={() => setColorFilter(null)}
              className={`px-2.5 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                !colorFilter ? "bg-text text-bg font-semibold" : "text-text-dim hover:text-text"
              }`}
            >
              All
            </button>
            {[
              { name: "Red", color: "#DC2626" },
              { name: "Blue", color: "#2563EB" },
              { name: "Green", color: "#16A34A" },
              { name: "Purple", color: "#9333EA" },
              { name: "Black", color: "#18181B" },
              { name: "Yellow", color: "#CA8A04" },
            ].map((c) => (
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

          {/* Sort + view controls */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
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

          {loadingCards && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-bg-surface rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* List view */}
          {!loadingCards && view === "list" && (
            <div>
              {sorted.map((card, i) => (
                <button
                  key={`${card.cardSetId}-${i}`}
                  onClick={() => setSelectedCard(card)}
                  className="flex items-center gap-3 w-full text-left py-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.01)] active:opacity-80 transition-colors"
                >
                  <div className="w-9 h-[50px] rounded-md overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-xs text-text-dim">{card.cardSetId} · {card.rarity} · {card.cardColor}</div>
                  </div>
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
          {!loadingCards && view === "grid" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {sorted.map((card, i) => (
                <button
                  key={`${card.cardSetId}-${i}`}
                  onClick={() => setSelectedCard(card)}
                  className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl overflow-hidden active:opacity-80 transition-colors text-left"
                >
                  <div className="aspect-[2.5/3.5] bg-[#E4E4E7]">
                    <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-xs font-mono text-text-dim">{card.cardSetId}</div>
                    {card.marketPrice != null && card.marketPrice > 0 ? (
                      <div className="font-mono text-xs font-semibold text-[#059669] mt-0.5">{formatPrice(card.marketPrice)}</div>
                    ) : (
                      <div className="text-xs text-text-dim mt-0.5">—</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

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
    </div>
  );
}
