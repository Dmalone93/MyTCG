"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";

type CardSet = { name: string; count: number; date: string | null };
type SortKey = "code" | "name" | "price";
type SortDir = "asc" | "desc";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

/** Categorise sets into groups */
function categoriseSet(name: string): string {
  if (/\bOP-\d/.test(name) || /\[OP-\d/.test(name)) return "Booster Packs";
  if (/\bST-\d/.test(name) || /\[ST-\d/.test(name)) return "Starter Decks";
  if (/\bEB-\d/.test(name) || /\[EB-\d/.test(name)) return "Extra Boosters";
  if (/Promo/i.test(name) || /\[P\]/.test(name)) return "Promos";
  return "Other";
}

const GROUP_ORDER = ["Booster Packs", "Starter Decks", "Extra Boosters", "Promos", "Other"];

export default function BrowsePage() {
  const [sets, setSets] = useState<CardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");

  useEffect(() => {
    fetch("/api/card-sets")
      .then((r) => r.json())
      .then((data) => setSets(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadSet(setName: string) {
    setSelectedSet(setName);
    setLoadingCards(true);
    setSortKey("code");
    setSortDir("asc");
    try {
      const res = await fetch(`/api/card-sets?set=${encodeURIComponent(setName)}`);
      setCards(await res.json());
    } catch { /* */ }
    setLoadingCards(false);
  }

  const sorted = useMemo(() => {
    return [...cards].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "code") {
        // Extract numeric part for proper ordering: OP01-001 → 1001, OP01-100 → 1100
        const numA = parseInt(a.cardSetId.replace(/\D/g, "") || "0");
        const numB = parseInt(b.cardSetId.replace(/\D/g, "") || "0");
        cmp = numA - numB;
      } else if (sortKey === "name") {
        cmp = a.cardName.localeCompare(b.cardName);
      } else if (sortKey === "price") {
        const pA = a.marketPrice ?? -1;
        const pB = b.marketPrice ?? -1;
        cmp = pA - pB;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [cards, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "desc" : "asc");
    }
  }

  // Group sets by category
  const groupedSets = useMemo(() => {
    const groups = new Map<string, CardSet[]>();
    for (const s of sets) {
      const group = categoriseSet(s.name);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(s);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      group: g,
      sets: groups.get(g)!.sort((a, b) => {
        // Extract number from set code e.g. "[OP-01]" → 1, "[ST-14]" → 14
        const numA = parseInt((a.name.match(/\[(?:OP|ST|EB)-?(\d+)\]/)?.[1]) ?? "999");
        const numB = parseInt((b.name.match(/\[(?:OP|ST|EB)-?(\d+)\]/)?.[1]) ?? "999");
        return numA - numB;
      }),
    }));
  }, [sets]);

  // Set list
  if (!selectedSet) {
    return (
      <div>
        <h1 className="text-lg font-bold text-text mb-5">Browse All Cards</h1>
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
            <div className="space-y-0.5">
              {groupSets.map((s) => (
                <button
                  key={s.name}
                  onClick={() => loadSet(s.name)}
                  className="flex items-center justify-between w-full text-left px-4 py-3 rounded-xl hover:bg-bg-surface active:opacity-80 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-text">{s.name}</div>
                    {s.date && <div className="text-xs text-text-dim mt-0.5">{s.date}</div>}
                  </div>
                  <span className="text-sm text-text-dim font-mono">{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Cards in set
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setSelectedSet(null); setCards([]); }} className="text-sm text-text-muted hover:text-text active:opacity-70">
          ← Sets
        </button>
        <h1 className="text-lg font-bold text-text flex-1 truncate">{selectedSet}</h1>
        <span className="text-sm text-text-dim font-mono">{cards.length}</span>
      </div>

      {/* Sort + view controls */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {(["code", "name", "price"] as SortKey[]).map((k) => {
          const active = sortKey === k;
          const label = k === "code" ? "Code" : k === "name" ? "Name" : "Price";
          return (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`text-sm px-2.5 py-1.5 rounded transition-colors ${
                active ? "text-text font-semibold bg-bg-surface" : "text-text-dim hover:text-text"
              }`}
            >
              {label} {active && (sortDir === "asc" ? "↑" : "↓")}
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="flex rounded-lg overflow-hidden">
          <button onClick={() => setView("list")} className={`px-2.5 py-1.5 text-xs transition-colors ${view === "list" ? "text-text font-semibold" : "text-text-dim"}`}>List</button>
          <button onClick={() => setView("grid")} className={`px-2.5 py-1.5 text-xs transition-colors ${view === "grid" ? "text-text font-semibold" : "text-text-dim"}`}>Grid</button>
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
          {sorted.map((card) => (
            <button
              key={card.cardSetId}
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
                <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{fmt(card.marketPrice)}</span>
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
          {sorted.map((card) => (
            <button
              key={card.cardSetId}
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
                  <div className="font-mono text-xs font-semibold text-[#059669] mt-0.5">{fmt(card.marketPrice)}</div>
                ) : (
                  <div className="text-xs text-text-dim mt-0.5">—</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Card detail */}
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
