"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionTab } from "./collection-tab";
import { CardGrid } from "./card-grid";
import { useRegion } from "@/components/region-selector";
import {
  createCollection as createCollectionAction,
  renameCollection as renameCollectionAction,
  deleteCollection as deleteCollectionAction,
  reorderCollections,
  getCards,
  getPrices,
  addCard as addCardAction,
  updateCard as updateCardAction,
  deleteCard as deleteCardAction,
  moveCard as moveCardAction,
} from "@/app/actions/collections";

export type Collection = {
  id: string;
  userId: string;
  name: string;
  sortOrder: number | null;
  createdAt: Date | null;
};

export type CollectionCard = {
  id: string;
  collectionId: string;
  userId: string;
  cardCode: string;
  cardName: string;
  quantity: number | null;
  condition: string | null;
  isGraded: boolean | null;
  grade: string | null;
  gradedCompany: string | null;
  acquiredPrice: string | null;
  notes: string | null;
  imageUrl: string | null;
  createdAt: Date | null;
};

export type CardPrice = {
  cardCode: string;
  rawMarket: string | null;
  gradedPrices: unknown;
  currency: string | null;
  fetchedAt: Date | null;
};

export function CollectionShell({
  initialCollections,
  initialActiveId,
  intelCardNames = [],
}: {
  initialCollections: Collection[];
  initialActiveId?: string;
  intelCardNames?: string[];
}) {
  const intelSet = new Set(intelCardNames);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [activeId, setActiveId] = useState<string | null>(
    (initialActiveId && initialCollections.some((c) => c.id === initialActiveId))
      ? initialActiveId
      : initialCollections[0]?.id ?? null
  );
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [prices, setPrices] = useState<Record<string, CardPrice>>({});
  const [loadingCards, setLoadingCards] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const fetchCards = useCallback(async (collectionId: string) => {
    setLoadingCards(true);
    const data = await getCards(collectionId);
    setCards(data);
    setLoadingCards(false);

    if (data.length > 0) {
      const codes = [...new Set(data.map((c) => c.cardCode))];
      const priceData = await getPrices(codes);
      const map: Record<string, CardPrice> = {};
      priceData.forEach((p) => (map[p.cardCode] = p));
      setPrices(map);
    } else {
      setPrices({});
    }
  }, []);

  useEffect(() => {
    if (activeId) fetchCards(activeId);
  }, [activeId, fetchCards]);

  async function handleCreateCollection() {
    const name = "New Collection";
    const row = await createCollectionAction(name, collections.length);
    setCollections((prev) => [...prev, row]);
    setActiveId(row.id);
  }

  async function handleRenameCollection(id: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await renameCollectionAction(id, trimmed);
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
    );
  }

  async function handleDeleteCollection(id: string) {
    await deleteCollectionAction(id);
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOver.current = index;
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOver.current === null) return;
    const from = dragItem.current;
    const to = dragOver.current;
    if (from === to) return;

    const reordered = [...collections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const updated = reordered.map((c, i) => ({ ...c, sortOrder: i }));
    setCollections(updated);
    await reorderCollections(updated.map((c) => ({ id: c.id, sortOrder: c.sortOrder! })));

    dragItem.current = null;
    dragOver.current = null;
  }

  async function handleAddCard(card: {
    cardCode: string;
    cardName: string;
    quantity: number;
    condition: string | null;
    isGraded: boolean;
    grade: string | null;
    gradedCompany: string | null;
    acquiredPrice: string | null;
    notes: string | null;
    imageUrl: string | null;
    marketPrice?: number | null;
  }) {
    if (!activeId) return;
    const row = await addCardAction({ ...card, collectionId: activeId });
    setCards((prev) => [...prev, row]);
    // Update prices state immediately with the catalog price
    if (card.marketPrice != null) {
      setPrices((prev) => ({
        ...prev,
        [card.cardCode]: {
          cardCode: card.cardCode,
          rawMarket: String(card.marketPrice),
          gradedPrices: null,
          currency: "EUR",
          fetchedAt: new Date(),
        },
      }));
    }
  }

  async function handleUpdateCard(id: string, updates: Partial<CollectionCard>) {
    const row = await updateCardAction(id, {
      quantity: updates.quantity ?? undefined,
      condition: updates.condition,
      isGraded: updates.isGraded ?? undefined,
      grade: updates.grade,
      gradedCompany: updates.gradedCompany,
      acquiredPrice: updates.acquiredPrice,
      notes: updates.notes,
    });
    if (row) setCards((prev) => prev.map((c) => (c.id === id ? row : c)));
  }

  async function handleDeleteCard(cardId: string) {
    await deleteCardAction(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  async function handleMoveCard(cardId: string, targetCollectionId: string) {
    await moveCardAction(cardId, targetCollectionId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  async function refreshPrices() {
    try {
      await fetch("/api/refresh-prices", { method: "POST" });
    } catch {
      // OK
    }
    if (activeId) await fetchCards(activeId);
  }

  const active = collections.find((c) => c.id === activeId);

  return (
    <div>
      {/* Collection tabs — sticky at top */}
      <div className="sticky top-0 z-10 bg-bg pt-1 pb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 border-b border-[rgba(0,0,0,0.06)]">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveId(col.id)}
              className={`px-3 py-2 text-sm whitespace-nowrap transition-colors active:opacity-70 relative ${
                col.id === activeId
                  ? "font-semibold text-text"
                  : col.name === "New Collection"
                    ? "text-text-dim hover:text-text"
                    : "text-text-muted hover:text-text"
              }`}
            >
              {col.name}
              {col.id === activeId && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
            </button>
          ))}
          <button
            onClick={handleCreateCollection}
            className="px-2.5 py-2 text-sm text-text-dim hover:text-text active:opacity-70 transition-colors flex-none whitespace-nowrap"
            title="New collection"
          >
            +
          </button>
        </div>
      </div>

      {/* QR Share modal */}
      {showQR && activeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-bg-elevated rounded-2xl p-6 w-full max-w-xs text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text mb-1">Share collection</h3>
            <p className="text-sm text-text-dim mb-4">Scan to view this collection</p>
            <div className="bg-white rounded-xl p-4 mb-4 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  typeof window !== "undefined" ? `${window.location.origin}/share/${activeId}` : `/share/${activeId}`
                )}`}
                alt="QR Code"
                className="w-[200px] h-[200px]"
              />
            </div>
            <div className="text-xs text-text-dim mb-4 font-mono break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/share/${activeId}` : `/share/${activeId}`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/share/${activeId}`;
                  navigator.clipboard.writeText(url);
                }}
                className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70 transition-colors"
              >
                Copy link
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 text-sm font-medium text-text-muted hover:text-text py-2.5 active:opacity-70"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection value hero — same pattern as portfolio on home */}
      {active && (
        <CollectionValueHero cards={cards} prices={prices} cardCount={cards.length} createdAt={active.createdAt} onShare={() => setShowQR(true)} />
      )}

      {active ? (
        <>
          <CardGrid
            cards={cards}
            prices={prices}
            loading={loadingCards}
            collections={collections}
            activeCollectionId={activeId!}
            intelCardNames={intelSet}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onMoveCard={handleMoveCard}
            onRefreshPrices={refreshPrices}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-text-muted text-sm mb-4">No collections yet</p>
          <button
            onClick={handleCreateCollection}
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold text-sm py-2.5 px-5 rounded-lg hover:bg-accent-hover transition-colors shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
          >
            <span className="text-base">+</span> Create your first collection
          </button>
        </div>
      )}
    </div>
  );
}

/** Portfolio-style value display for a single collection */
function CollectionValueHero({ cards, prices, cardCount, createdAt, onShare }: {
  cards: CollectionCard[];
  prices: Record<string, CardPrice>;
  cardCount: number;
  createdAt: Date | null;
  onShare?: () => void;
}) {
  const { formatPrice } = useRegion();

  const totalValue = cards.reduce((s, c) => {
    const p = prices[c.cardCode];
    return s + (p?.rawMarket ? parseFloat(String(p.rawMarket)) : 0) * (c.quantity ?? 1);
  }, 0);

  const totalSpent = cards.reduce(
    (s, c) => s + (c.acquiredPrice ? parseFloat(c.acquiredPrice) : 0) * (c.quantity ?? 1),
    0
  );

  const pl = totalValue - totalSpent;
  const plPct = totalSpent > 0 ? (pl / totalSpent) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-[rgba(0,0,0,0.06)] mt-3 mb-4 relative">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-text-dim uppercase tracking-wider">Collection value</div>
        {onShare && (
          <button
            onClick={onShare}
            className="text-text-dim hover:text-text active:opacity-70 transition-colors p-1 -mt-1 -mr-1"
            title="Share collection"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        )}
      </div>
      <div className="font-mono text-3xl font-bold text-text leading-tight">
        {totalValue > 0 ? formatPrice(totalValue) : "—"}
      </div>
      {(totalSpent > 0 || totalValue > 0) && (
        <div className="flex items-center gap-4 mt-2">
          {totalSpent > 0 && (
            <div>
              <div className="text-xs text-text-dim">Spent</div>
              <div className="font-mono text-sm text-text">{formatPrice(totalSpent)}</div>
            </div>
          )}
          {totalSpent > 0 && totalValue > 0 && (
            <>
              <div className="w-px h-8 bg-[rgba(0,0,0,0.08)]" />
              <div>
                <div className="text-xs text-text-dim">P/L</div>
                <div className={`font-mono text-sm font-semibold ${pl >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {pl >= 0 ? "+" : ""}{formatPrice(pl)} ({pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mt-3 text-xs text-text-dim">
        <span>{cardCount} cards</span>
        {createdAt && (
          <>
            <span>·</span>
            <span>{new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </>
        )}
      </div>
    </div>
  );
}
