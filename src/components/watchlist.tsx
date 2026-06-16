"use client";

import { useEffect, useState } from "react";

type WatchlistItem = {
  id: string;
  cardCode: string;
  cardName: string;
  imageUrl: string | null;
  targetPrice: string | null;
  notes: string | null;
  createdAt: string | null;
  currentPrice?: number | null;
};

export function Watchlist({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [fetched, setFetched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ cardSetId: string; cardName: string; imageUrl: string; marketPrice: number | null }>>([]);
  const [searching, setSearching] = useState(false);

  function loadWatchlist() {
    if (fetched) return;
    setLoading(true);
    setFetched(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function refresh() {
    setFetched(false);
    loadWatchlist();
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }

    setSearching(true);
    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(q)}`);
      const cards = await res.json();
      setSearchResults(cards.slice(0, 8));
    } catch { /* */ }
    setSearching(false);
  }

  async function addToWatchlist(card: { cardSetId: string; cardName: string; imageUrl: string }) {
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardCode: card.cardSetId,
          cardName: card.cardName,
          imageUrl: card.imageUrl,
        }),
      });
      setAdding(false);
      setSearchQuery("");
      setSearchResults([]);
      setFetched(false);
      loadWatchlist();
    } catch { /* */ }
  }

  async function removeFromWatchlist(cardCode: string) {
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardCode }),
      });
      setItems((prev) => prev.filter((i) => i.cardCode !== cardCode));
    } catch { /* */ }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

  return (
    <div className="mb-4">
      <button
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          if (!next) loadWatchlist();
        }}
        className="flex items-center gap-2 mb-2 group"
      >
        <h2 className="font-bold text-sm sm:text-base text-text">Watchlist</h2>
        <span className="text-text-dim text-xs group-hover:text-text transition-colors">
          {collapsed ? "▸" : "▾"}
        </span>
        {items.length > 0 && (
          <span className="text-[10px] font-mono text-text-dim">{items.length} cards</span>
        )}
      </button>

      {!collapsed && (
        <div className="bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-xl overflow-hidden">
          {/* Add button / search */}
          <div className="px-3 py-2.5 border-b border-[rgba(0,0,0,0.04)] flex items-center gap-2">
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="text-xs font-semibold text-accent hover:underline active:opacity-70"
              >
                + Watch a card
              </button>
            ) : (
              <div className="flex-1">
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search card to watch..."
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-sm text-text placeholder:text-text-dim"
                />
                {searching && <span className="text-text-dim text-xs animate-pulse">...</span>}
              </div>
            )}
            {adding && (
              <button
                onClick={() => { setAdding(false); setSearchQuery(""); setSearchResults([]); }}
                className="text-xs text-text-dim hover:text-text active:opacity-70"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border-b border-[rgba(0,0,0,0.04)] max-h-[200px] overflow-y-auto">
              {searchResults.map((card, i) => (
                <button
                  key={card.cardSetId + i}
                  onClick={() => addToWatchlist(card)}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 hover:bg-[rgba(59,130,246,0.06)] active:opacity-80 transition-colors border-b border-[rgba(0,0,0,0.02)] last:border-0"
                >
                  <div className="w-6 h-[33px] rounded overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-text block truncate">{card.cardName}</span>
                    <span className="text-[10px] text-text-dim">{card.cardSetId}</span>
                  </span>
                  {card.marketPrice != null && card.marketPrice > 0 && (
                    <span className="font-mono text-xs text-[#059669] flex-none">{fmt(card.marketPrice)}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="py-6 text-center text-text-dim text-sm">Loading watchlist...</div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && fetched && !adding && (
            <div className="py-6 text-center text-text-dim text-xs">
              No cards on your watchlist yet
            </div>
          )}

          {/* Watchlist items */}
          {items.length > 0 && (
            <div>
              {items.map((item) => {
                const current = item.currentPrice ?? 0;
                const target = item.targetPrice ? parseFloat(item.targetPrice) : null;
                const belowTarget = target != null && current > 0 && current <= target;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-[rgba(0,0,0,0.03)] last:border-0 ${
                      belowTarget ? "bg-[rgba(74,222,128,0.05)]" : ""
                    }`}
                  >
                    {item.imageUrl && (
                      <div className="w-8 h-[44px] rounded overflow-hidden bg-[#E4E4E7] flex-none">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{item.cardName}</div>
                      <div className="flex items-center gap-2 text-[10px] text-text-dim">
                        <span className="font-mono">{item.cardCode}</span>
                        {target != null && (
                          <span className={belowTarget ? "text-[#059669] font-semibold" : ""}>
                            Target: {fmt(target)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-none">
                      {current > 0 && (
                        <div className="font-mono text-sm text-text">{fmt(current)}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(item.cardCode)}
                      className="text-text-dim hover:text-red-400 active:text-red-400 text-sm p-1 flex-none transition-colors"
                      title="Remove from watchlist"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
