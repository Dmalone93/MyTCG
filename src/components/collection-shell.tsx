"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionTab } from "./collection-tab";
import { CardGrid } from "./card-grid";
import { MetricStrip } from "./metric-strip";
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
  intelCardNames = [],
}: {
  initialCollections: Collection[];
  intelCardNames?: string[];
}) {
  const intelSet = new Set(intelCardNames);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [activeId, setActiveId] = useState<string | null>(
    initialCollections[0]?.id ?? null
  );
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [prices, setPrices] = useState<Record<string, CardPrice>>({});
  const [loadingCards, setLoadingCards] = useState(false);
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
      <div className="mb-5">
        {/* Title + metrics — editorial style */}
        {active && (
          <div className="mb-4">
            <h1 className="text-xl font-bold text-text">{active.name}</h1>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-text-dim">
              <span>{cards.length} cards</span>
              {active.createdAt && (
                <span>· Created {new Date(active.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              )}
            </div>
            <div className="h-px bg-[rgba(0,0,0,0.08)] mt-3 mb-1" />
            <MetricStrip cards={cards} prices={prices} />
            <div className="h-px bg-[rgba(0,0,0,0.08)] mt-1" />
          </div>
        )}

        {/* Collection switcher — only when multiple */}
        {collections.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveId(col.id)}
                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors active:opacity-70 ${
                  col.id === activeId
                    ? "font-semibold text-text bg-bg-surface"
                    : col.name === "New Collection"
                      ? "text-text-dim hover:text-text"
                      : "text-text-muted hover:text-text"
                }`}
              >
                {col.name}
              </button>
            ))}
            <button
              onClick={handleCreateCollection}
              className="px-2.5 py-1.5 text-sm text-text-dim hover:text-text active:opacity-70 transition-colors flex-none whitespace-nowrap"
              title="New collection"
            >
              +
            </button>
          </div>
        )}
      </div>

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
