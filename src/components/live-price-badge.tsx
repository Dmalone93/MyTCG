"use client";

import { useEffect, useState } from "react";
import { useRegion } from "./region-selector";

type Variant = {
  version: string;
  rarity: string;
  name: string;
  image: string | null;
  priceEur: number | null;
  priceUsd: number | null;
  avg30dEur: number | null;
  avg7dEur: number | null;
  available: number | null;
};

type LivePrice = {
  found: boolean;
  priceEur: number | null;
  priceUsd: number | null;
  price: number | null;
  avg30dEur: number | null;
  avg7dEur: number | null;
  lowestNmEur: number | null;
  availableItems: number | null;
  tcgMarketUsd: number | null;
  trend: "rising" | "falling" | "stable" | null;
  variants: Variant[];
  source: string;
};

const VERSION_LABELS: Record<string, string> = {
  "V.1": "Standard",
  "V.2": "Alternate Art",
  "V.3": "Manga Rare",
  "V.4": "Super Alternate Art",
  "V.5": "Manga Rare",
  None: "Standard",
};

export type SelectedVariant = {
  version: string;
  rarity: string;
  name: string;
  image: string | null;
  priceEur: number | null;
  priceUsd: number | null;
};

export function LivePriceBadge({ cardCode, cardName, onSelectVariant, activeVersion }: {
  cardCode: string;
  cardName?: string;
  onSelectVariant?: (v: SelectedVariant) => void;
  activeVersion?: string | null;
}) {
  const [data, setData] = useState<LivePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatLocalPrice, config } = useRegion();

  useEffect(() => {
    const params = new URLSearchParams();
    if (cardCode) params.set("code", cardCode);
    if (cardName) params.set("name", cardName);

    fetch(`/api/live-price?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardCode, cardName]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-[#E4E4E7] rounded" />
        <div className="h-8 w-24 bg-[#E4E4E7] rounded" />
        <div className="h-16 w-full bg-[#E4E4E7] rounded-xl" />
      </div>
    );
  }

  if (!data?.found) return null;
  if (!data.priceEur && !data.priceUsd && data.variants.length === 0) return null;

  const fmt = (eur: number | null, usd: number | null) => formatLocalPrice(eur, usd);

  const trendColor = data.trend === "rising" ? "text-[#059669]" : data.trend === "falling" ? "text-[#DC2626]" : "text-text-muted";
  const trendLabel = data.trend === "rising" ? "↑ Rising" : data.trend === "falling" ? "↓ Falling" : "→ Stable";
  const sourceLabel = config.region === "US" ? "TCGPlayer" : "Cardmarket";

  return (
    <div className="space-y-4">
      {/* Header + source */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim uppercase tracking-wider">Market Price</span>
        <span className="text-xs text-text-dim flex items-center gap-1.5">
          <img
            src={config.region === "US" ? "/logos/tcgplayer.svg" : "/logos/cardmarket.png"}
            alt={sourceLabel}
            className="h-[14px] opacity-60"
          />
          {sourceLabel}
        </span>
      </div>

      {/* Hero price */}
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl font-bold text-text">
          {fmt(data.priceEur, data.priceUsd)}
        </span>
        {data.trend && (
          <span className={`text-sm font-semibold ${trendColor}`}>{trendLabel}</span>
        )}
      </div>

      {/* Price stats row */}
      {config.region !== "US" && (data.avg30dEur || data.avg7dEur || data.lowestNmEur) && (
        <div className="flex gap-4">
          {data.lowestNmEur != null && (
            <div>
              <div className="text-xs text-text-dim">Low NM</div>
              <div className="font-mono text-sm text-text">{fmt(data.lowestNmEur, null)}</div>
            </div>
          )}
          {data.avg7dEur != null && (
            <div>
              <div className="text-xs text-text-dim">7d Avg</div>
              <div className="font-mono text-sm text-text">{fmt(data.avg7dEur, null)}</div>
            </div>
          )}
          {data.avg30dEur != null && (
            <div>
              <div className="text-xs text-text-dim">30d Avg</div>
              <div className="font-mono text-sm text-text">{fmt(data.avg30dEur, null)}</div>
            </div>
          )}
          {data.availableItems != null && (
            <div>
              <div className="text-xs text-text-dim">Listed</div>
              <div className="font-mono text-sm text-text">{data.availableItems}</div>
            </div>
          )}
        </div>
      )}

      {/* TCGPlayer comparison for EU/UK */}
      {config.region !== "US" && data.tcgMarketUsd != null && (
        <div className="text-xs text-text-dim">
          TCGPlayer (US): <span className="font-mono">${data.tcgMarketUsd.toFixed(2)}</span>
        </div>
      )}

      {/* ALL Variants — every version with image, rarity, and price */}
      {data.variants.length > 0 && (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
            All versions ({data.variants.length})
          </div>
          <div className="space-y-2">
            {data.variants.map((v, i) => {
              const label = VERSION_LABELS[v.version] ?? v.version ?? "Standard";
              const hasPrice = v.priceEur != null || v.priceUsd != null;
              const isActive = activeVersion != null ? v.version === activeVersion : i === 0;
              return (
                <button
                  key={i}
                  onClick={() => onSelectVariant?.({
                    version: v.version,
                    rarity: v.rarity,
                    name: v.name,
                    image: v.image,
                    priceEur: v.priceEur,
                    priceUsd: v.priceUsd,
                  })}
                  className={`w-full flex items-center gap-3 rounded-xl p-2.5 text-left active:opacity-70 transition-all ${
                    isActive
                      ? "bg-[rgba(5,150,105,0.06)] border border-[rgba(5,150,105,0.2)]"
                      : "bg-bg-surface border border-transparent"
                  }`}
                >
                  {/* Variant image */}
                  {v.image && (
                    <img
                      src={v.image}
                      alt={`${v.name} ${label}`}
                      className="w-[44px] h-[62px] rounded-lg object-cover flex-none"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{label}</div>
                    <div className="text-xs text-text-dim">{v.rarity}</div>
                    {v.avg30dEur != null && config.region !== "US" && (
                      <div className="text-xs text-text-dim mt-0.5">
                        30d avg: <span className="font-mono">{fmt(v.avg30dEur, null)}</span>
                      </div>
                    )}
                    {v.available != null && (
                      <div className="text-xs text-text-dim">
                        {v.available} listed
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex-none text-right">
                    {hasPrice ? (
                      <span className="font-mono text-sm font-semibold text-[#059669]">
                        {fmt(v.priceEur, v.priceUsd)}
                      </span>
                    ) : (
                      <span className="text-sm text-text-dim">—</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
