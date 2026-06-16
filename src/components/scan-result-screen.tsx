"use client";

import { useEffect, useState, useMemo } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useRegion } from "@/components/region-selector";
import { GradeSelector } from "@/components/grade-selector";
import { Sparkline } from "@/lib/charts/sparkline";
import { MockListingProvider } from "@/lib/listings/mock-provider";
import type { Listing } from "@/lib/listings/types";

const listingProvider = new MockListingProvider();

const SOURCE_LABELS: Record<string, { label: string; available: boolean }> = {
  ebay: { label: "eBay", available: true },
  cardmarket: { label: "Cardmarket", available: false },
  tcgplayer: { label: "TCGPlayer", available: false },
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
  onClose,
}: {
  card: CatalogCard;
  onRescan: () => void;
  onManualEntry: () => void;
  onClose: () => void;
}) {
  const { formatPrice, config } = useRegion();

  const [askingRaw, setAskingRaw] = useState("");
  const asking = parseFloat(askingRaw) || 0;

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

    listingProvider.getListings(card.cardSetId, grade !== "Raw" ? grade : undefined)
      .then(setListings)
      .catch(() => {});
  }, [card.cardSetId, grade]);

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

  const marketConverted = displayPrice ? displayPrice * config.rate : null;
  const delta = marketConverted && asking > 0 ? asking - marketConverted : null;
  const deltaPercent = marketConverted && delta ? (delta / marketConverted) * 100 : null;
  const isGoodDeal = delta != null && delta < 0;
  const isBadDeal = delta != null && delta > 0;

  const stalenessLabel = useMemo(() => {
    if (!priceData.fetchedAt) return "cached";
    const mins = Math.round((Date.now() - new Date(priceData.fetchedAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }, [priceData.fetchedAt]);

  return (
    <div className="space-y-5">
      {/* 1. Verification header */}
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

      {/* Wrong card? — prominent, always visible */}
      <div className="flex gap-2">
        <button
          onClick={onRescan}
          className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 px-4 rounded-xl hover:bg-[rgba(0,0,0,0.04)] active:opacity-70 transition-colors"
        >
          Not this card? Rescan
        </button>
        <button
          onClick={onManualEntry}
          className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 px-4 rounded-xl hover:bg-[rgba(0,0,0,0.04)] active:opacity-70 transition-colors"
        >
          Enter code
        </button>
      </div>

      {/* 2. Asking vs market — the hero */}
      <div className="bg-bg-surface rounded-2xl p-4">
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Asking price</div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-text-dim text-lg">{config.symbol}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={askingRaw}
            onChange={(e) => setAskingRaw(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none font-mono text-2xl font-bold text-text placeholder:text-text-dim/30"
          />
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-dim">Market</span>
            <span className="text-xs text-text-dim/60">{stalenessLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-text">
              {marketConverted != null ? formatPrice(displayPrice!) : "—"}
            </span>
            <button
              onClick={refreshPrice}
              disabled={refreshing}
              className="text-xs text-text-dim hover:text-text active:opacity-70 disabled:opacity-40"
            >
              {refreshing ? "..." : "↻"}
            </button>
          </div>
        </div>

        {delta != null && (
          <div className={`flex items-center justify-between py-3 border-t border-[rgba(0,0,0,0.06)] ${isGoodDeal ? "bg-[rgba(5,150,105,0.04)]" : isBadDeal ? "bg-[rgba(220,38,38,0.04)]" : ""} -mx-4 px-4 rounded-b-2xl`}>
            <span className="text-sm font-medium text-text">
              {isGoodDeal ? "Below market" : isBadDeal ? "Above market" : "At market"}
            </span>
            <div className="text-right">
              <span className={`font-mono text-lg font-bold ${isGoodDeal ? "text-[#059669]" : isBadDeal ? "text-[#DC2626]" : "text-text"}`}>
                {delta >= 0 ? "+" : ""}{formatPrice(delta / config.rate)}
              </span>
              {deltaPercent != null && (
                <span className={`font-mono text-sm ml-2 ${isGoodDeal ? "text-[#059669]" : isBadDeal ? "text-[#DC2626]" : "text-text-dim"}`}>
                  ({deltaPercent >= 0 ? "+" : ""}{deltaPercent.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Live listings */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Cheapest listings</div>
        <div className="space-y-1.5">
          {listings
            .sort((a, b) => a.price - b.price)
            .map((listing, i) => {
              const info = SOURCE_LABELS[listing.source];
              const sym = CURRENCY_SYMBOLS[listing.currency] ?? listing.currency;
              return (
                <div key={i} className="flex items-center gap-3 bg-bg-surface rounded-xl px-3 py-2.5">
                  <span className="text-sm font-medium text-text w-[80px] flex-none">{info.label}</span>
                  <span className="text-sm text-text-dim flex-1">{listing.condition}</span>
                  <div className="text-right flex-none">
                    <span className="font-mono text-sm font-semibold text-text">
                      {sym}{listing.price.toFixed(2)}
                    </span>
                    {listing.shipping != null && listing.shipping > 0 && (
                      <span className="text-xs text-text-dim ml-1">+{sym}{listing.shipping.toFixed(2)}</span>
                    )}
                  </div>
                  {info.available ? (
                    <a href={listing.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-text-muted hover:text-text flex-none">
                      View →
                    </a>
                  ) : (
                    <span className="text-xs text-text-dim/50 flex-none">Soon</span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* 4. Recent market price chart */}
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

      {/* 5. Graded vs Raw */}
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
