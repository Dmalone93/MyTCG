"use client";

import { useCallback, useState } from "react";
import type { Collection, CollectionCard, CardPrice } from "./collection-shell";
import { AddCardForm } from "./add-card-form";
import { CardPicker } from "./card-picker";
import { ScanModal } from "./scan-modal";
import { CardDetailModal } from "./card-detail-modal";
import { ContextMenu } from "./context-menu";
import { useLongPress } from "@/hooks/use-long-press";
import type { CatalogCard } from "@/lib/catalog/types";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function isInTheNews(card: CollectionCard, intelNames: Set<string>): boolean {
  return (
    intelNames.has(card.cardCode.toUpperCase()) ||
    intelNames.has(card.cardCode.toLowerCase()) ||
    intelNames.has(card.cardName.toUpperCase()) ||
    intelNames.has(card.cardName.toLowerCase())
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
  onAddCard: (card: {
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
  }) => Promise<void>;
  onUpdateCard: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onMoveCard: (id: string, targetCollectionId: string) => Promise<void>;
  onRefreshPrices?: () => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [pickedCard, setPickedCard] = useState<CatalogCard | null>(null);
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
          onClick={() => { setShowPicker(true); setPickedCard(null); }}
          className="inline-flex items-center gap-[7px] flex-1 justify-center bg-accent text-white font-semibold text-sm py-[12px] px-[17px] rounded-[10px] hover:bg-accent-hover transition-colors shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
        >
          <span className="text-base leading-none -mt-px">+</span> Add card
        </button>
        <button
          onClick={() => setShowScan(true)}
          className="inline-flex items-center gap-[7px] flex-none bg-bg-surface text-text-muted border border-[rgba(255,255,255,0.06)] rounded-[10px] py-[12px] px-[16px] text-sm font-semibold hover:bg-[#27272A] hover:text-text transition-colors"
          title="Scan a card"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
          Scan
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

      {/* Card picker → add form flow */}
      {showPicker && !pickedCard && (
        <CardPicker
          onPick={(card) => setPickedCard(card)}
          onCancel={() => setShowPicker(false)}
        />
      )}
      {showPicker && pickedCard && (
        <AddCardForm
          prefill={pickedCard}
          onSubmit={async (card) => {
            await onAddCard(card);
            setPickedCard(null);
            setShowPicker(false);
          }}
          onCancel={() => {
            setPickedCard(null);
            setShowPicker(false);
          }}
        />
      )}

      {/* Empty state */}
      {cards.length === 0 && !showPicker && (
        <div className="py-16 text-center">
          <p className="text-text-dim text-sm mb-4">No cards in this collection</p>
          <button
            onClick={() => { setShowPicker(true); setPickedCard(null); }}
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
                  price={prices[card.cardCode] ?? null}
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
              price={prices[card.cardCode] ?? null}
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
          price={prices[selectedCard.cardCode] ?? null}
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
            if (confirm(`Delete "${contextMenu.card.cardName}"?`)) {
              await onDeleteCard(contextMenu.card.id);
            }
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Scan modal */}
      {showScan && (
        <ScanModal
          onResult={(card) => {
            setShowScan(false);
            setPickedCard(card);
            setShowPicker(true);
          }}
          onClose={() => setShowScan(false)}
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

  const market = num(price?.rawMarket);
  const grade = card.grade ?? "PSA 10";
  const gp = (price?.gradedPrices as Record<string, number> | null)?.[grade] ?? 0;

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
        {card.cardCode}
      </td>
      <td className="py-2.5 px-3 font-medium text-text">
        <span className="flex items-center gap-1.5">
          {card.cardName}
          {inNews && (
            <span className="text-[9px] font-mono tracking-[.08em] uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-none">
              news
            </span>
          )}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-mono">{card.quantity ?? 1}</td>
      <td className="py-2.5 px-3 text-text-muted">
        {card.condition ?? "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono">
        {card.acquiredPrice != null ? fmt(num(card.acquiredPrice)) : "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono">
        {market > 0 ? fmt(market) : "—"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[#4ADE80]">
        {gp > 0 ? fmt(gp) : "—"}
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

  const market = num(price?.rawMarket);
  const grade = card.grade ?? "PSA 10";
  const gp = (price?.gradedPrices as Record<string, number> | null)?.[grade] ?? 0;

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
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.cardName}
          className="w-full rounded-lg mb-3 aspect-[2.5/3.5] object-cover"
        />
      )}
      <div className="font-mono text-xs text-text-dim mb-1">
        {card.cardCode}
      </div>
      <div className="font-medium text-sm text-text mb-2 truncate">
        {card.cardName}
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
          {market > 0 ? fmt(market) : "—"}
        </span>
        {gp > 0 && (
          <span className="text-[#4ADE80] font-mono">{fmt(gp)}</span>
        )}
      </div>
    </div>
  );
}
