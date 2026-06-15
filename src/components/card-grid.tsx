"use client";

import { useCallback, useState } from "react";
import type { Collection, CollectionCard, CardPrice } from "./collection-shell";
import { AddCardForm } from "./add-card-form";
import { CardDetailModal } from "./card-detail-modal";
import { ContextMenu } from "./context-menu";
import { useLongPress } from "@/hooks/use-long-press";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function isInTheNews(card: CollectionCard, intelNames: Set<string>): boolean {
  return (
    intelNames.has(card.card_code.toUpperCase()) ||
    intelNames.has(card.card_code.toLowerCase()) ||
    intelNames.has(card.card_name.toUpperCase()) ||
    intelNames.has(card.card_name.toLowerCase())
  );
}

export function CardGrid({
  cards,
  prices,
  loading,
  collections,
  activeCollectionId,
  intelCardNames,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onRefreshPrices,
}: {
  cards: CollectionCard[];
  prices: Record<string, CardPrice>;
  loading: boolean;
  collections: Collection[];
  activeCollectionId: string;
  intelCardNames?: Set<string>;
  onAddCard: (card: Omit<CollectionCard, "id" | "user_id" | "collection_id" | "created_at">) => Promise<void>;
  onUpdateCard: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onMoveCard: (id: string, targetCollectionId: string) => Promise<void>;
  onRefreshPrices?: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"table" | "grid">("table");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    card: CollectionCard;
    x: number;
    y: number;
  } | null>(null);

  function openContextMenu(card: CollectionCard, x: number, y: number) {
    setContextMenu({ card, x, y });
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-text-dim text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-[7px] flex-1 justify-center bg-accent text-white font-semibold text-sm py-[12px] px-[17px] rounded-[10px] hover:bg-accent-hover transition-colors shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
        >
          <span className="text-base leading-none -mt-px">+</span> Add card
        </button>
        {onRefreshPrices && (
          <button
            onClick={async () => {
              setRefreshing(true);
              await onRefreshPrices();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-[7px] flex-none bg-bg-surface text-text-muted border border-[rgba(255,255,255,0.06)] rounded-[10px] py-[12px] px-[16px] text-sm font-semibold hover:bg-[#27272A] hover:text-text disabled:opacity-50 transition-colors"
            title="Update all card prices"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "animate-spin" : ""}><path d="M23 4v6h-6M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Update prices
          </button>
        )}
        <div className="flex border border-[rgba(255,255,255,0.06)] bg-bg-surface rounded-[10px] overflow-hidden flex-none">
          <button
            onClick={() => setView("table")}
            className={`px-[14px] py-[10px] text-[13.5px] font-semibold transition-colors ${
              view === "table"
                ? "bg-[#27272A] text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setView("grid")}
            className={`px-[14px] py-[10px] text-[13.5px] font-semibold transition-colors ${
              view === "grid"
                ? "bg-[#27272A] text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Add card form */}
      {showAdd && (
        <AddCardForm
          onSubmit={async (card) => {
            await onAddCard(card);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Empty state */}
      {cards.length === 0 && !showAdd && (
        <div className="py-16 text-center">
          <p className="text-text-dim text-sm mb-4">No cards in this collection</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-accent text-sm font-semibold hover:underline"
          >
            + Add your first card
          </button>
        </div>
      )}

      {/* Table view */}
      {cards.length > 0 && view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Code
                </th>
                <th className="text-left font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Name
                </th>
                <th className="text-right font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Qty
                </th>
                <th className="text-left font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Condition
                </th>
                <th className="text-right font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Paid
                </th>
                <th className="text-right font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Market
                </th>
                <th className="text-right font-mono text-[10px] tracking-[.1em] uppercase text-text-dim py-2 px-3">
                  Graded
                </th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <CardTableRow
                  key={card.id}
                  card={card}
                  price={prices[card.card_code] ?? null}
                  inNews={intelCardNames ? isInTheNews(card, intelCardNames) : false}
                  onClick={() => setSelectedCard(card)}
                  onContextMenu={(x, y) => openContextMenu(card, x, y)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {cards.length > 0 && view === "grid" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {cards.map((card) => (
            <CardGridTile
              key={card.id}
              card={card}
              price={prices[card.card_code] ?? null}
              inNews={intelCardNames ? isInTheNews(card, intelCardNames) : false}
              onClick={() => setSelectedCard(card)}
              onContextMenu={(x, y) => openContextMenu(card, x, y)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          price={prices[selectedCard.card_code] ?? null}
          onClose={() => setSelectedCard(null)}
          onUpdate={async (id, updates) => {
            await onUpdateCard(id, updates);
            // Update local selected card state
            setSelectedCard((prev) =>
              prev ? { ...prev, ...updates } : null
            );
          }}
          onDelete={async (id) => {
            await onDeleteCard(id);
            setSelectedCard(null);
          }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          collections={collections}
          currentCollectionId={activeCollectionId}
          onMove={async (targetId) => {
            await onMoveCard(contextMenu.card.id, targetId);
            setContextMenu(null);
          }}
          onDelete={async () => {
            if (confirm(`Delete "${contextMenu.card.card_name}"?`)) {
              await onDeleteCard(contextMenu.card.id);
            }
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/** Table row with click + long-press/right-click */
function CardTableRow({
  card,
  price,
  inNews,
  onClick,
  onContextMenu,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  inNews: boolean;
  onClick: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const longPress = useLongPress(
    useCallback((x: number, y: number) => onContextMenu(x, y), [onContextMenu])
  );

  const market = price?.raw_market ?? null;
  const grade = card.grade ?? "PSA 10";
  const graded = price?.graded_prices?.[grade] ?? null;

  return (
    <tr
      className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer select-none"
      onClick={onClick}
      onContextMenu={longPress.onContextMenu}
      onPointerDown={longPress.onPointerDown}
      onPointerUp={longPress.onPointerUp}
      onPointerMove={longPress.onPointerMove}
      onPointerLeave={longPress.onPointerLeave}
    >
      <td className="py-2.5 px-3 font-mono text-text-muted">
        {card.card_code}
      </td>
      <td className="py-2.5 px-3 font-medium text-text">
        <span className="flex items-center gap-1.5">
          {card.card_name}
          {inNews && (
            <span className="text-[9px] font-mono tracking-[.08em] uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-none">
              news
            </span>
          )}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-mono">{card.quantity}</td>
      <td className="py-2.5 px-3 text-text-muted">
        {card.condition ?? "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono">
        {card.acquired_price != null ? fmt(card.acquired_price) : "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono">
        {market != null ? fmt(market) : "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[#4ADE80]">
        {graded != null ? fmt(graded) : "—"}
      </td>
    </tr>
  );
}

/** Grid tile with click + long-press/right-click */
function CardGridTile({
  card,
  price,
  inNews,
  onClick,
  onContextMenu,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  inNews: boolean;
  onClick: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const longPress = useLongPress(
    useCallback((x: number, y: number) => onContextMenu(x, y), [onContextMenu])
  );

  const market = price?.raw_market ?? null;
  const grade = card.grade ?? "PSA 10";
  const graded = price?.graded_prices?.[grade] ?? null;

  return (
    <div
      className="bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl p-4 hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer select-none"
      onClick={onClick}
      onContextMenu={longPress.onContextMenu}
      onPointerDown={longPress.onPointerDown}
      onPointerUp={longPress.onPointerUp}
      onPointerMove={longPress.onPointerMove}
      onPointerLeave={longPress.onPointerLeave}
    >
      {card.image_url && (
        <img
          src={card.image_url}
          alt={card.card_name}
          className="w-full rounded-lg mb-3 aspect-[2.5/3.5] object-cover"
        />
      )}
      <div className="font-mono text-xs text-text-dim mb-1">
        {card.card_code}
      </div>
      <div className="font-medium text-sm text-text mb-2 truncate">
        {card.card_name}
      </div>
      {inNews && (
        <div className="mb-2">
          <span className="text-[9px] font-mono tracking-[.08em] uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            in the news
          </span>
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">
          {market != null ? fmt(market) : "—"}
        </span>
        {graded != null && (
          <span className="text-[#4ADE80] font-mono">{fmt(graded)}</span>
        )}
      </div>
    </div>
  );
}
