"use client";

import { useEffect, useState, useMemo } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useRegion } from "@/components/region-selector";
import { GradeSelector } from "@/components/grade-selector";
import { Sparkline } from "@/lib/charts/sparkline";
import { MockListingProvider } from "@/lib/listings/mock-provider";
import type { Listing } from "@/lib/listings/types";

const listingProvider = new MockListingProvider();

const SOURCE_INFO: Record<string, { logo: string; alt: string; height: number }> = {
  ebay: { logo: "/logos/ebay.svg", alt: "eBay", height: 20 },
  cardmarket: { logo: "/logos/cardmarket.png", alt: "Cardmarket", height: 20 },
  tcgplayer: { logo: "/logos/tcgplayer.svg", alt: "TCGplayer", height: 20 },
};

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function daysAgo(dateStr: string): string {
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

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
  const { formatPrice, formatLocalPrice, config } = useRegion();

  const [grade, setGrade] = useState("Raw");

  const [priceData, setPriceData] = useState<PriceData>({ market: card.marketPrice, fetchedAt: null, gradedPrices: null });
  const [liveEurPrice, setLiveEurPrice] = useState<number | null>(null);
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
        if (data.found) {
          // Store EUR price separately for local formatting
          if (data.priceEur) setLiveEurPrice(data.priceEur);
          // Update market price (USD fallback)
          const usdPrice = data.priceUsd ?? data.price;
          if (usdPrice) {
            setPriceData((prev) => ({
              ...prev,
              market: usdPrice,
              fetchedAt: new Date().toISOString(),
            }));
          }
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

  function renderListing(listing: Listing, i: number, isCheapest: boolean = false) {
    const info = SOURCE_INFO[listing.source];
    const sym = CURRENCY_SYMBOLS[listing.currency] ?? listing.currency;
    const total = listing.price + (listing.shipping ?? 0);
    const freeShipping = listing.shipping == null || listing.shipping === 0;

    return (
      <a
        key={i}
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-3 rounded-xl px-3 py-3 active:opacity-80 transition-colors ${
          isCheapest ? "bg-[rgba(5,150,105,0.06)] border border-[rgba(5,150,105,0.15)]" : "bg-bg-surface"
        }`}
      >
        {/* Source logo */}
        <img
          src={info.logo}
          alt={info.alt}
          style={{ height: info.height }}
          className="flex-none w-[60px] object-contain object-left"
        />

        {/* Condition + shipping */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text">{listing.condition}</div>
          <div className="text-xs text-text-dim">
            {freeShipping ? (
              <span className="text-[#059669]">Free shipping</span>
            ) : (
              <span>+{sym}{listing.shipping!.toFixed(2)} shipping</span>
            )}
          </div>
        </div>

        {/* Price + total */}
        <div className="text-right flex-none">
          <div className="font-mono text-sm font-semibold text-text">
            {sym}{total.toFixed(2)}
          </div>
          {!freeShipping && (
            <div className="font-mono text-xs text-text-dim">
              {sym}{listing.price.toFixed(2)} + ship
            </div>
          )}
        </div>

        {/* Sold date */}
        {listing.soldDate && (
          <span className="text-xs text-text-dim flex-none w-[40px] text-right">
            {daysAgo(listing.soldDate)}
          </span>
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
          {liveEurPrice != null
            ? formatLocalPrice(liveEurPrice, displayPrice)
            : displayPrice != null ? formatPrice(displayPrice) : "—"}
        </div>
      </div>

      {/* 3. Active listings */}
      {activeListings.length > 0 && (() => {
        const sorted = [...activeListings].sort((a, b) =>
          (a.price + (a.shipping ?? 0)) - (b.price + (b.shipping ?? 0))
        );
        const cheapestTotal = sorted[0] ? sorted[0].price + (sorted[0].shipping ?? 0) : 0;
        return (
          <div>
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Active listings</div>
            <div className="space-y-1.5">
              {sorted.map((l, i) => {
                const total = l.price + (l.shipping ?? 0);
                return renderListing(l, i, total === cheapestTotal);
              })}
            </div>
          </div>
        );
      })()}

      {/* 4. Sold listings */}
      {soldListings.length > 0 && (() => {
        const sorted = [...soldListings].sort((a, b) => (b.soldDate ?? "").localeCompare(a.soldDate ?? ""));
        const avgSold = soldListings.reduce((s, l) => s + l.price + (l.shipping ?? 0), 0) / soldListings.length;
        const sym = CURRENCY_SYMBOLS[soldListings[0].currency] ?? soldListings[0].currency;
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-dim uppercase tracking-wider">Recently sold</span>
              <span className="font-mono text-xs text-text-dim">Avg {sym}{avgSold.toFixed(2)}</span>
            </div>
            <div className="space-y-1.5">
              {sorted.map((l, i) => renderListing(l, i + 100))}
            </div>
          </div>
        );
      })()}

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
