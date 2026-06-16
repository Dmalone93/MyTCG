"use client";

import { useCallback, useState, useRef } from "react";
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
    marketPrice?: number | null;
  }) => Promise<void>;
  onUpdateCard: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onMoveCard: (id: string, targetCollectionId: string) => Promise<void>;
  onRefreshPrices?: () => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showQuickScan, setShowQuickScan] = useState(false);
  const [pickedCard, setPickedCard] = useState<CatalogCard | null>(null);
  const [view, setView] = useState<"table" | "grid">("table");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [quickAddMsg, setQuickAddMsg] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    card: CollectionCard;
    x: number;
    y: number;
  } | null>(null);

  async function quickAdd(card: CatalogCard) {
    setQuickAddMsg(`Adding ${card.cardName}...`);
    await onAddCard({
      cardCode: card.cardSetId,
      cardName: card.cardName,
      quantity: 1,
      condition: "NM",
      isGraded: false,
      grade: null,
      gradedCompany: null,
      acquiredPrice: null,
      notes: null,
      imageUrl: card.imageUrl ?? null,
      marketPrice: card.marketPrice ?? null,
    });
    setQuickAddMsg(`✓ Added ${card.cardName}`);
    setTimeout(() => setQuickAddMsg(null), 2000);
  }

  function openContextMenu(card: CollectionCard, x: number, y: number) {
    setContextMenu({ card, x, y });
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl p-3 animate-pulse">
            <div className="w-10 h-[56px] rounded-md bg-[#E4E4E7]" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-[#E4E4E7] rounded mb-2" />
              <div className="h-3 w-20 bg-[#E4E4E7] rounded" />
            </div>
            <div className="h-4 w-16 bg-[#E4E4E7] rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setShowPicker(true); setPickedCard(null); }}
          className="text-sm text-text-muted hover:text-text active:opacity-70 transition-colors"
        >
          + Add card
        </button>
        <div className="flex-1" />
        {onRefreshPrices && (
          <button
            onClick={async () => {
              setRefreshing(true);
              await onRefreshPrices();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="text-text-dim text-sm hover:text-text-muted disabled:opacity-40 active:opacity-70 transition-colors"
            title="Update prices"
          >
            {refreshing ? "Updating..." : "Update prices"}
          </button>
        )}
        <div className="flex gap-0.5 flex-none">
          <button
            onClick={() => setView("table")}
            className={`p-2 rounded-lg transition-colors ${
              view === "table"
                ? "text-text bg-bg-surface"
                : "text-text-dim hover:text-text-muted"
            }`}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg transition-colors ${
              view === "grid"
                ? "text-text bg-bg-surface"
                : "text-text-dim hover:text-text-muted"
            }`}
            title="Grid view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card picker → add form flow */}
      {showPicker && !pickedCard && (
        <CardPicker
          onPick={(card) => setPickedCard(card)}
          onPickMultiple={async (cards) => {
            for (const card of cards) {
              await onAddCard({
                cardCode: card.cardSetId,
                cardName: card.cardName,
                quantity: 1,
                condition: "NM",
                isGraded: false,
                grade: null,
                gradedCompany: null,
                acquiredPrice: null,
                notes: null,
                imageUrl: card.imageUrl ?? null,
                marketPrice: card.marketPrice ?? null,
              });
            }
            setShowPicker(false);
            setQuickAddMsg(`✓ Added ${cards.length} cards`);
            setTimeout(() => setQuickAddMsg(null), 2000);
          }}
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
        <div className="py-20 text-center">
          <div className="text-text-dim text-base mb-2">No cards yet</div>
          <button
            onClick={() => { setShowPicker(true); setPickedCard(null); }}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            + Add your first card
          </button>
        </div>
      )}

      {/* Table view — compact list on mobile, full table on sm+ */}
      {cards.length > 0 && view === "table" && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(0,0,0,0.1)]">
                  <th className="w-[40px] py-2 px-2"></th>
                  <th className="text-left text-xs text-text-dim py-2 px-3 tracking-wide">Code</th>
                  <th className="text-left text-xs text-text-dim py-2 px-3 tracking-wide">Name</th>
                  <th className="text-right text-xs text-text-dim py-2 px-3 tracking-wide">Qty</th>
                  <th className="text-left text-xs text-text-dim py-2 px-3 tracking-wide">Cond</th>
                  <th className="text-right text-xs text-text-dim py-2 px-3 tracking-wide">Paid</th>
                  <th className="text-right text-xs text-text-dim py-2 px-3 tracking-wide">Market</th>
                  <th className="text-right text-xs text-text-dim py-2 px-3 tracking-wide">Graded</th>
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

          {/* Mobile list */}
          <div className="sm:hidden space-y-2">
            {cards.map((card) => (
              <CardMobileRow
                key={card.id}
                card={card}
                price={prices[card.cardCode] ?? null}
                inNews={intelCardNames ? isInTheNews(card, intelCardNames) : false}
                onClick={() => setSelectedCard(card)}
                onContextMenu={(x, y) => openContextMenu(card, x, y)}
              />
            ))}
          </div>
        </>
      )}

      {/* Grid view */}
      {cards.length > 0 && view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 sm:gap-3">
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
          key={selectedCard.id}
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

      {/* Scan modal — regular (from Add card → Scan) */}
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

      {/* Quick scan modal — auto-adds to collection */}
      {showQuickScan && (
        <ScanModal
          onResult={async (card) => {
            await quickAdd(card);
            // Don't close — let user keep scanning more cards
          }}
          onClose={() => setShowQuickScan(false)}
          quickMode
        />
      )}

      {/* Quick add toast */}
      {quickAddMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-bg-elevated border border-[rgba(0,0,0,0.08)] rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-sm text-text font-medium animate-fade-in">
          {quickAddMsg}
        </div>
      )}
    </div>
  );
}

/** Table row with click + long-press/right-click + thumbnail + hover preview */
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
  const [showPreview, setShowPreview] = useState(false);
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<HTMLTableCellElement>(null);

  const market = num(price?.rawMarket);
  const grade = card.grade ?? "PSA 10";
  const gp = (price?.gradedPrices as Record<string, number> | null)?.[grade] ?? 0;

  function handleNameEnter() {
    if (!card.imageUrl) return;
    previewTimeout.current = setTimeout(() => setShowPreview(true), 300);
  }

  function handleNameLeave() {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setShowPreview(false);
  }

  return (
    <tr
      className="border-b border-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.015)] transition-colors cursor-pointer select-none"
      onClick={onClick}
      onContextMenu={longPress.onContextMenu}
      onPointerDown={longPress.onPointerDown}
      onPointerUp={longPress.onPointerUp}
      onPointerMove={longPress.onPointerMove}
      onPointerLeave={longPress.onPointerLeave}
    >
      <td
        ref={nameRef}
        className="py-1.5 px-2 w-[44px]"
        onMouseEnter={handleNameEnter}
        onMouseLeave={handleNameLeave}
      >
        {card.imageUrl ? (
          <div className="w-[30px] h-[42px] rounded overflow-hidden bg-[#E4E4E7] flex-none">
            <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-[30px] h-[42px] rounded bg-[#E4E4E7]" />
        )}
        {showPreview && card.imageUrl && nameRef.current && (() => {
          const rect = nameRef.current!.getBoundingClientRect();
          return (
            <div
              className="fixed z-[100] pointer-events-none"
              style={{ left: rect.left, top: rect.top - 8, transform: "translateY(-100%)" }}
            >
              <div className="w-[160px] rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-[rgba(0,0,0,0.08)]">
                <img src={card.imageUrl} alt={card.cardName} className="w-full aspect-[2.5/3.5] object-cover" />
              </div>
            </div>
          );
        })()}
      </td>
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
      <td className="py-2.5 px-3 text-right font-mono text-[#059669]">
        {gp > 0 ? fmt(gp) : "—"}
      </td>
    </tr>
  );
}

/** Mobile compact list row */
function CardMobileRow({
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
      className="flex items-center gap-3 py-3 border-b border-[rgba(0,0,0,0.05)] active:opacity-80 transition-colors cursor-pointer select-none"
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
          className="w-12 h-[67px] rounded-md object-cover flex-none"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-medium text-sm text-text truncate">{card.cardName}</span>
          {inNews && (
            <span className="text-[9px] font-mono tracking-[.08em] uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-none">
              news
            </span>
          )}
        </div>
        <div className="font-mono text-xs text-text-dim">
          {card.cardCode} {card.quantity && card.quantity > 1 ? `× ${card.quantity}` : ""}
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="font-mono text-sm text-text">
          {market > 0 ? fmt(market) : "—"}
        </div>
        {gp > 0 && (
          <div className="font-mono text-xs text-[#059669]">{fmt(gp)}</div>
        )}
      </div>
    </div>
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
      className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl p-3 sm:p-4 hover:border-[rgba(0,0,0,0.1)] active:bg-[rgba(0,0,0,0.03)] transition-colors cursor-pointer select-none"
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
          <span className="text-[#059669] font-mono">{fmt(gp)}</span>
        )}
      </div>
    </div>
  );
}
