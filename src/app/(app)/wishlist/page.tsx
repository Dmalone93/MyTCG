"use client";

import { useState, useEffect, useRef } from "react";
import { useRegion } from "@/components/region-selector";
import { CardDataSheet } from "@/components/card-data-sheet";
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

export default function WishlistPage() {
  const { formatPrice } = useRegion();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCard, setViewCard] = useState<WishlistItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const collectionsCache = useRef<Array<{ id: string; name: string }> | null>(null);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        setToast("Create a collection first");
        setTimeout(() => setToast(null), 1500);
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
      // Remove from wishlist after adding
      await removeCard(item.cardCode);
      setToast(`Added ${item.cardName}`);
      setTimeout(() => setToast(null), 1500);
    } catch { /* */ }
  }

  const totalMarket = items.reduce((s, i) => s + Number(i.currentPrice ?? 0), 0);
  const totalTarget = items.reduce((s, i) => s + Number(i.targetPrice ?? i.currentPrice ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-text mb-2">Wishlist</h1>
      <p className="text-sm text-text-dim mb-4">Cards you want — track prices until you're ready to buy.</p>

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
          <div className="text-sm text-text-muted">Browse or search for cards, then tap &quot;Add to wishlist&quot;</div>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl px-4 py-3 shadow-lg text-sm text-text font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
