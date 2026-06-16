"use client";

import { useEffect, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { CardDataSheet } from "@/components/card-data-sheet";

type CardSet = { name: string; count: number; date: string | null };
type SortKey = "code" | "name" | "price";
type SortDir = "asc" | "desc";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

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
    try {
      const res = await fetch(`/api/card-sets?set=${encodeURIComponent(setName)}`);
      setCards(await res.json());
    } catch { /* */ }
    setLoadingCards(false);
  }

  function sortedCards() {
    return [...cards].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "code") cmp = a.cardSetId.localeCompare(b.cardSetId);
      else if (sortKey === "name") cmp = a.cardName.localeCompare(b.cardName);
      else if (sortKey === "price") cmp = (a.marketPrice ?? 0) - (b.marketPrice ?? 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "desc" : "asc");
    }
  }

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`text-sm px-2.5 py-1.5 rounded transition-colors ${
          active ? "text-text font-semibold" : "text-text-dim hover:text-text"
        }`}
      >
        {label} {active && (sortDir === "asc" ? "↑" : "↓")}
      </button>
    );
  }

  // Set list
  if (!selectedSet) {
    return (
      <div>
        <h1 className="text-lg font-bold text-text mb-4">Browse All Cards</h1>
        {loading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-14 bg-bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        )}
        <div className="space-y-1">
          {sets.map((s) => (
            <button
              key={s.name}
              onClick={() => loadSet(s.name)}
              className="flex items-center justify-between w-full text-left px-4 py-3.5 rounded-xl hover:bg-bg-surface active:opacity-80 transition-colors"
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
    );
  }

  // Cards in set
  const sorted = sortedCards();

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
        <SortButton k="code" label="Code" />
        <SortButton k="name" label="Name" />
        <SortButton k="price" label="Price" />
        <div className="flex-1" />
        <div className="flex rounded-lg overflow-hidden">
          <button onClick={() => setView("list")} className={`px-2.5 py-1.5 text-xs transition-colors ${view === "list" ? "text-text font-semibold" : "text-text-dim"}`}>List</button>
          <button onClick={() => setView("grid")} className={`px-2.5 py-1.5 text-xs transition-colors ${view === "grid" ? "text-text font-semibold" : "text-text-dim"}`}>Grid</button>
        </div>
      </div>

      {loadingCards && (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => (
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
