"use client";

import { useEffect, useState, useMemo } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useRegion } from "@/components/region-selector";
import { GradeSelector } from "@/components/grade-selector";
import { Sparkline } from "@/lib/charts/sparkline";
import { MockListingProvider } from "@/lib/listings/mock-provider";
import type { Listing } from "@/lib/listings/types";

const listingProvider = new MockListingProvider();

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ebay: { label: "eBay", color: "#E53238" },
  cardmarket: { label: "CM", color: "#1A1A6C" },
  tcgplayer: { label: "TCP", color: "#3B82F6" },
};

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

type PriceData = {
  market: number | null;
  fetchedAt: string | null;
  gradedPrices: Record<string, Record<string, number>> | null;
};

type HistoryData = {
  points: { price: number; date: string }[];
  high: number;
  low: number;
  current: number;
  change: number;
};

export function ScanResultScreen({
  card,
  onRescan,
  onManualEntry,
  onAddToCollection,
  onClose,
}: {
  card: CatalogCard;
  onRescan: () => void;
  onManualEntry: () => void;
  onAddToCollection?: () => void;
  onClose: () => void;
}) {
  const { formatPrice, config } = useRegion();

  const [grade, setGrade] = useState("Raw");

  const [priceData, setPriceData] = useState<PriceData>({ market: card.marketPrice, fetchedAt: null, gradedPrices: null });
  const [refreshing, setRefreshing] = useState(false);

  const [history, setHistory] = useState<HistoryData | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    fetch(`/api/price-history?code=${encodeURIComponent(card.cardSetId)}&range=30`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setHistory(d); })
      .catch(() => {});

    listingProvider.getListings(card.cardSetId, card.cardName, grade !== "Raw" ? grade : undefined)
      .then(setListings)
      .catch(() => {});
  }, [card.cardSetId, card.cardName, grade]);

  async function refreshPrice() {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ code: card.cardSetId });
      if (card.cardName) params.set("name", card.cardName);
      const res = await fetch(`/api/live-price?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.price) {
          setPriceData((prev) => ({
            ...prev,
            market: data.price,
            fetchedAt: new Date().toISOString(),
          }));
        }
      }
    } catch { /* offline — keep stale */ }
    setRefreshing(false);
  }

  const displayPrice = useMemo(() => {
    if (grade === "Raw") return priceData.market;
    const gp = priceData.gradedPrices;
    if (!gp) return priceData.market;
    const [company, num] = grade.split(" ");
    return gp[company]?.[num] ?? priceData.market;
  }, [grade, priceData]);

  const stalenessLabel = useMemo(() => {
    if (!priceData.fetchedAt) return "cached";
    const mins = Math.round((Date.now() - new Date(priceData.fetchedAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }, [priceData.fetchedAt]);

  // Split listings into active and sold
  const activeListings = listings.filter((l) => !l.soldDate);
  const soldListings = listings.filter((l) => l.soldDate);

  function renderListing(listing: Listing, i: number) {
    const badge = SOURCE_BADGE[listing.source];
    const sym = CURRENCY_SYMBOLS[listing.currency] ?? listing.currency;
    return (
      <a
        key={i}
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 bg-bg-surface rounded-xl px-3 py-2.5 active:opacity-80 transition-colors"
      >
        <span
          className="text-xs font-bold text-white px-1.5 py-0.5 rounded flex-none"
          style={{ backgroundColor: badge.color }}
        >
          {badge.label}
        </span>
        <span className="text-sm text-text-dim flex-1 truncate">{listing.condition}</span>
        <div className="text-right flex-none">
          <span className="font-mono text-sm font-semibold text-text">
            {sym}{listing.price.toFixed(2)}
          </span>
          {listing.shipping != null && listing.shipping > 0 && (
            <span className="text-xs text-text-dim ml-1">+{sym}{listing.shipping.toFixed(2)}</span>
          )}
        </div>
        {listing.soldDate && (
          <span className="text-xs text-text-dim flex-none">{listing.soldDate}</span>
        )}
      </a>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Card verification */}
      <div className="flex gap-4 items-start">
        {card.imageUrl && (
          <img src={card.imageUrl} alt={card.cardName} className="w-[72px] rounded-lg aspect-[2.5/3.5] object-cover flex-none" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-text">{card.cardName}</div>
          <div className="font-mono text-sm text-text-dim mt-0.5">{card.cardSetId} · {card.rarity}</div>
          {card.cardColor && <div className="text-sm text-text-dim">{card.cardColor}</div>}
        </div>
      </div>

      {/* Actions: rescan, enter code, add to collection */}
      <div className="flex gap-2">
        <button
          onClick={onRescan}
          className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 px-3 rounded-xl active:opacity-70 transition-colors"
        >
          Rescan
        </button>
        <button
          onClick={onManualEntry}
          className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 px-3 rounded-xl active:opacity-70 transition-colors"
        >
          Enter code
        </button>
        {onAddToCollection && (
          <button
            onClick={onAddToCollection}
            className="flex-1 bg-text text-bg font-medium text-sm py-2.5 px-3 rounded-xl active:opacity-80 transition-colors"
          >
            Add to collection
          </button>
        )}
      </div>

      {/* 2. Market price — the hero number */}
      <div className="bg-bg-surface rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-dim uppercase tracking-wider">Market price</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-dim/60">{stalenessLabel}</span>
            <button
              onClick={refreshPrice}
              disabled={refreshing}
              className="text-sm text-text-dim hover:text-text active:opacity-70 disabled:opacity-40"
            >
              {refreshing ? "..." : "↻"}
            </button>
          </div>
        </div>
        <div className="font-mono text-2xl font-bold text-text">
          {displayPrice != null ? formatPrice(displayPrice) : "—"}
        </div>
      </div>

      {/* 3. Active listings */}
      {activeListings.length > 0 && (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Active listings</div>
          <div className="space-y-1.5">
            {activeListings
              .sort((a, b) => a.price - b.price)
              .map((l, i) => renderListing(l, i))}
          </div>
        </div>
      )}

      {/* 4. Sold listings */}
      {soldListings.length > 0 && (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Recently sold</div>
          <div className="space-y-1.5">
            {soldListings
              .sort((a, b) => (b.soldDate ?? "").localeCompare(a.soldDate ?? ""))
              .map((l, i) => renderListing(l, i + 100))}
          </div>
        </div>
      )}

      {/* 5. Recent market price chart */}
      {history && history.points.length >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim uppercase tracking-wider">Recent market price</span>
            <span className="text-xs text-text-dim">30d</span>
          </div>
          <div className="bg-bg-surface rounded-xl p-3">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-text">{formatPrice(history.current)}</span>
              <span className={`font-mono text-sm ${history.change >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {history.change >= 0 ? "+" : ""}{history.change.toFixed(1)}%
              </span>
              <div className="flex-1" />
              <span className="text-xs text-text-dim">H {formatPrice(history.high)}</span>
              <span className="text-xs text-text-dim">L {formatPrice(history.low)}</span>
            </div>
            <Sparkline data={history.points.map((p) => p.price)} height={60} />
          </div>
        </div>
      )}

      {/* 6. Graded vs Raw */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Graded vs Raw</div>
        <GradeSelector value={grade} onChange={setGrade} />
        {grade !== "Raw" && displayPrice && (
          <div className="mt-3 bg-bg-surface rounded-xl px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-text-dim">{grade} value</span>
            <span className="font-mono text-sm font-semibold text-text">{formatPrice(displayPrice)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
