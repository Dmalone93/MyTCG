"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionTab } from "./collection-tab";
import { CardGrid } from "./card-grid";
import { MetricStrip } from "./metric-strip";

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type CollectionCard = {
  id: string;
  collection_id: string;
  user_id: string;
  card_code: string;
  card_name: string;
  quantity: number;
  condition: string | null;
  is_graded: boolean;
  grade: string | null;
  graded_company: string | null;
  acquired_price: number | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
};

export type CardPrice = {
  card_code: string;
  raw_market: number | null;
  graded_prices: Record<string, number> | null;
  currency: string;
  fetched_at: string;
};

export function CollectionShell({
  initialCollections,
  intelCardNames = [],
}: {
  initialCollections: Collection[];
  intelCardNames?: string[];
}) {
  const intelSet = new Set(intelCardNames);
  const supabase = createClient();
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [activeId, setActiveId] = useState<string | null>(
    initialCollections[0]?.id ?? null
  );
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [prices, setPrices] = useState<Record<string, CardPrice>>({});
  const [loadingCards, setLoadingCards] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  // Fetch cards when active collection changes
  const fetchCards = useCallback(
    async (collectionId: string) => {
      setLoadingCards(true);
      const { data } = await supabase
        .from("collection_cards")
        .select("*")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: true });
      setCards(data ?? []);
      setLoadingCards(false);

      // Fetch prices for these cards
      if (data && data.length > 0) {
        const codes = [...new Set(data.map((c) => c.card_code))];
        const { data: priceData } = await supabase
          .from("card_prices")
          .select("*")
          .in("card_code", codes);
        if (priceData) {
          const map: Record<string, CardPrice> = {};
          priceData.forEach((p) => (map[p.card_code] = p));
          setPrices(map);
        }
      } else {
        setPrices({});
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (activeId) fetchCards(activeId);
  }, [activeId, fetchCards]);

  // Create a new collection
  async function createCollection() {
    const name = `Collection ${collections.length + 1}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("collections")
      .insert({
        user_id: user.id,
        name,
        sort_order: collections.length,
      })
      .select()
      .single();

    if (data && !error) {
      setCollections((prev) => [...prev, data]);
      setActiveId(data.id);
    }
  }

  // Rename a collection
  async function renameCollection(id: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await supabase.from("collections").update({ name: trimmed }).eq("id", id);
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
    );
  }

  // Delete a collection
  async function deleteCollection(id: string) {
    await supabase.from("collections").delete().eq("id", id);
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  // Reorder via drag
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

    // Update sort_order
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCollections(updated);

    // Persist
    for (const c of updated) {
      await supabase
        .from("collections")
        .update({ sort_order: c.sort_order })
        .eq("id", c.id);
    }

    dragItem.current = null;
    dragOver.current = null;
  }

  // Add a card to the active collection
  async function addCard(card: Omit<CollectionCard, "id" | "user_id" | "collection_id" | "created_at">) {
    if (!activeId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("collection_cards")
      .insert({
        ...card,
        collection_id: activeId,
        user_id: user.id,
      })
      .select()
      .single();

    if (data && !error) {
      setCards((prev) => [...prev, data]);
    }
  }

  // Update a card
  async function updateCard(cardId: string, updates: Partial<CollectionCard>) {
    const { data, error } = await supabase
      .from("collection_cards")
      .update(updates)
      .eq("id", cardId)
      .select()
      .single();

    if (data && !error) {
      setCards((prev) => prev.map((c) => (c.id === cardId ? data : c)));
    }
  }

  // Delete a card
  async function deleteCard(cardId: string) {
    await supabase.from("collection_cards").delete().eq("id", cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  // Move a card to another collection
  async function moveCard(cardId: string, targetCollectionId: string) {
    await supabase
      .from("collection_cards")
      .update({ collection_id: targetCollectionId })
      .eq("id", cardId);
    // Remove from current view (optimistic)
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  // Refresh prices via the server route, then re-fetch from cache
  async function refreshPrices() {
    try {
      await fetch("/api/refresh-prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}`,
        },
      });
    } catch {
      // Manual trigger may fail if CRON_SECRET isn't exposed — that's OK for dev
    }
    // Re-fetch cached prices regardless
    if (activeId) await fetchCards(activeId);
  }

  const active = collections.find((c) => c.id === activeId);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {collections.map((col, i) => (
          <CollectionTab
            key={col.id}
            collection={col}
            isActive={col.id === activeId}
            onClick={() => setActiveId(col.id)}
            onRename={(name) => renameCollection(col.id, name)}
            onDelete={() => deleteCollection(col.id)}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
          />
        ))}
        <button
          onClick={createCollection}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-[rgba(255,255,255,0.06)] bg-bg-surface text-text-muted hover:bg-[#27272A] hover:text-text transition-colors text-lg flex-none"
          title="New collection"
        >
          +
        </button>
      </div>

      {/* Content */}
      {active ? (
        <>
          <MetricStrip cards={cards} prices={prices} />
          <CardGrid
            cards={cards}
            prices={prices}
            loading={loadingCards}
            collections={collections}
            activeCollectionId={activeId!}
            intelCardNames={intelSet}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onDeleteCard={deleteCard}
            onMoveCard={moveCard}
            onRefreshPrices={refreshPrices}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-text-muted text-sm mb-4">
            No collections yet
          </p>
          <button
            onClick={createCollection}
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold text-sm py-2.5 px-5 rounded-lg hover:bg-accent-hover transition-colors shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
          >
            <span className="text-base">+</span> Create your first collection
          </button>
        </div>
      )}
    </div>
  );
}
