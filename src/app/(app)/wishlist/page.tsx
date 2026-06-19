"use client";

import { useState, useEffect, useRef } from "react";
import { useRegion } from "@/components/region-selector";
import { CardDataSheet } from "@/components/card-data-sheet";
import { ScanModal } from "@/components/scan-modal";
import { addCard as addCardAction } from "@/app/actions/collections";

type WishlistItem = {
  id: string;
  cardCode: string;
  cardName: string;
  imageUrl: string | null;
  targetPrice: string | null;
  notes: string | null;
  currentPrice: string | null;
  createdAt: string;
};

type SearchResult = {
  cardSetId: string;
  cardName: string;
  imageUrl: string | null;
  marketPrice: number | null;
};

export default function WishlistPage() {
  const { formatPrice } = useRegion();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCard, setViewCard] = useState<WishlistItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const collectionsCache = useRef<Array<{ id: string; name: string }> | null>(null);

  // Add sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-focus search input when sheet opens
  useEffect(() => {
    if (showAddSheet) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [showAddSheet]);

  async function removeCard(cardCode: string) {
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardCode }),
    });
    setItems((prev) => prev.filter((i) => i.cardCode !== cardCode));
  }

  async function addToCollection(item: WishlistItem) {
    try {
      if (!collectionsCache.current) {
        const res = await fetch("/api/collections");
        if (res.ok) collectionsCache.current = await res.json();
      }
      const cols = collectionsCache.current;
      if (!cols || cols.length === 0) {
        showToast("Create a collection first");
        return;
      }
      await addCardAction({
        collectionId: cols[0].id,
        cardCode: item.cardCode,
        cardName: item.cardName,
        quantity: 1,
        condition: "NM",
        isGraded: false,
        grade: null,
        gradedCompany: null,
        acquiredPrice: item.currentPrice ?? null,
        notes: null,
        imageUrl: item.imageUrl ?? null,
        marketPrice: item.currentPrice ? Number(item.currentPrice) : null,
      });
      await removeCard(item.cardCode);
      showToast(`Added ${item.cardName}`);
    } catch { /* */ }
  }

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search-cards?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const all: SearchResult[] = await res.json();
          setSearchResults(all);
        }
      } catch { /* */ }
      setSearching(false);
    }, 300);
  }

  async function addToWishlist(card: SearchResult) {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardCode: card.cardSetId,
          cardName: card.cardName,
          imageUrl: card.imageUrl,
        }),
      });
      if (res.status === 409) {
        showToast("Already on wishlist");
      } else if (res.ok) {
        const row = await res.json();
        setItems((prev) => [...prev, { ...row, currentPrice: card.marketPrice ? String(card.marketPrice) : null }]);
        showToast(`Added ${card.cardName}`);
        setShowAddSheet(false);
      }
    } catch { /* */ }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  const totalMarket = items.reduce((s, i) => s + Number(i.currentPrice ?? 0), 0);
  const totalTarget = items.reduce((s, i) => s + Number(i.targetPrice ?? i.currentPrice ?? 0), 0);

  return (
    <div>
      {/* Header with + Add button */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-text">Wishlist</h1>
        <button
          onClick={() => setShowAddSheet(true)}
          className="text-sm font-medium text-text-muted hover:text-text active:opacity-70 transition-colors"
        >
          + Add
        </button>
      </div>
      <p className="text-sm text-text-dim mb-4">Cards you want — track prices until you&apos;re ready to buy.</p>

      {/* Summary */}
      {items.length > 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-text-dim uppercase tracking-wider">Cards wanted</div>
              <div className="font-mono text-2xl font-bold text-text">{items.length}</div>
            </div>
            <div className="w-px h-10 bg-[rgba(0,0,0,0.08)]" />
            <div>
              <div className="text-xs text-text-dim uppercase tracking-wider">Total market</div>
              <div className="font-mono text-2xl font-bold text-[#059669]">{formatPrice(totalMarket)}</div>
            </div>
            {totalTarget !== totalMarket && totalTarget > 0 && (
              <>
                <div className="w-px h-10 bg-[rgba(0,0,0,0.08)]" />
                <div>
                  <div className="text-xs text-text-dim uppercase tracking-wider">Budget</div>
                  <div className="font-mono text-lg font-semibold text-text">{formatPrice(totalTarget)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cards list */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-bg-surface rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-dim text-base mb-2">No cards on your wishlist</div>
          <div className="text-sm text-text-muted mb-4">Track cards you want and their prices</div>
          <button
            onClick={() => setShowAddSheet(true)}
            className="bg-text text-bg font-medium text-sm py-2.5 px-6 rounded-xl active:opacity-80 transition-colors"
          >
            + Add your first card
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => {
            const market = Number(item.currentPrice ?? 0);
            const target = Number(item.targetPrice ?? 0);
            const isUnderTarget = target > 0 && market > 0 && market <= target;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 bg-white border rounded-2xl px-3 py-3 ${
                  isUnderTarget ? "border-[#059669]/30 bg-[rgba(5,150,105,0.03)]" : "border-[rgba(0,0,0,0.06)]"
                }`}
              >
                <button onClick={() => setViewCard(item)} className="flex-none active:opacity-80">
                  {item.imageUrl ? (
                    <div className="w-11 aspect-[63/88] rounded-lg overflow-hidden bg-[#E4E4E7]">
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-11 aspect-[63/88] rounded-lg bg-[#E4E4E7]" />
                  )}
                </button>
                <div className="flex-1 min-w-0" onClick={() => setViewCard(item)}>
                  <div className="text-sm font-medium text-text truncate">{item.cardName}</div>
                  <div className="text-xs text-text-dim font-mono">{item.cardCode}</div>
                  {isUnderTarget && (
                    <div className="text-xs text-[#059669] font-medium mt-0.5">Below target!</div>
                  )}
                </div>
                <div className="text-right flex-none">
                  {market > 0 ? (
                    <div className="font-mono text-sm font-semibold text-[#059669]">{formatPrice(market)}</div>
                  ) : (
                    <div className="text-xs text-text-dim">—</div>
                  )}
                  {target > 0 && (
                    <div className="font-mono text-xs text-text-dim">target {formatPrice(target)}</div>
                  )}
                </div>
                <button
                  onClick={() => addToCollection(item)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#059669]/10 hover:bg-[#059669]/20 text-[#059669] text-sm font-bold flex-none active:opacity-70"
                  title="Add to collection"
                >
                  +
                </button>
                <button
                  onClick={() => removeCard(item.cardCode)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.08)] text-text-dim text-sm flex-none active:opacity-70"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ADD CARD BOTTOM SHEET ═══ */}
      {showAddSheet && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowAddSheet(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-bg-elevated rounded-t-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "80vh" }}
          >
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text">Add to wishlist</h3>
              <button onClick={() => setShowAddSheet(false)} className="text-sm text-text-muted active:opacity-70">
                Done
              </button>
            </div>

            {/* Search input + scan icon */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl px-4 py-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name or code..."
                  className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="text-text-dim text-sm active:opacity-70">
                    ×
                  </button>
                )}
                <button
                  onClick={() => { setShowAddSheet(false); setShowScan(true); }}
                  className="flex-none p-1 rounded-lg text-text-dim hover:text-text active:opacity-70 transition-colors"
                  title="Scan card"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
              {searching && searchQuery && searchResults.length === 0 && (
                <div className="p-6 text-center text-sm text-text-dim">Searching...</div>
              )}

              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="p-6 text-center text-sm text-text-dim">No cards found</div>
              )}

              {searchResults.map((card) => {
                const alreadyAdded = items.some((i) => i.cardCode === card.cardSetId);
                return (
                  <button
                    key={card.cardSetId}
                    onClick={() => !alreadyAdded && addToWishlist(card)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[rgba(0,0,0,0.04)] transition-colors ${
                      alreadyAdded ? "opacity-40" : "active:bg-bg-surface"
                    }`}
                  >
                    {card.imageUrl ? (
                      <div className="w-10 aspect-[63/88] rounded-lg overflow-hidden bg-[#E4E4E7] flex-none">
                        <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 aspect-[63/88] rounded-lg bg-[#E4E4E7] flex-none" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{card.cardName}</div>
                      <div className="text-xs text-text-dim font-mono">{card.cardSetId}</div>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-xs text-text-dim flex-none">On list</span>
                    ) : (
                      <span className="text-xs text-[#059669] font-medium flex-none">+ Add</span>
                    )}
                  </button>
                );
              })}

              {!searchQuery && (
                <div className="p-6 text-center text-sm text-text-dim">
                  Type a card name or code, or scan a card
                </div>
              )}
            </div>

            {/* Safe area padding */}
            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          </div>
        </div>
      )}

      {/* Card detail */}
      {viewCard && (
        <CardDataSheet
          cardCode={viewCard.cardCode}
          cardName={viewCard.cardName}
          imageUrl={viewCard.imageUrl ?? ""}
          marketPrice={viewCard.currentPrice ? Number(viewCard.currentPrice) : undefined}
          onClose={() => setViewCard(null)}
        />
      )}

      {/* Scan modal — scan to add to wishlist */}
      {showScan && (
        <ScanModal
          onResult={(card) => {
            setShowScan(false);
            addToWishlist({
              cardSetId: card.cardSetId,
              cardName: card.cardName,
              imageUrl: card.imageUrl,
              marketPrice: card.marketPrice,
            });
          }}
          onClose={() => setShowScan(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl px-4 py-3 shadow-lg text-sm text-text font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
