"use client";

import { useEffect, useState } from "react";
import { useRegion } from "./region-selector";

type InlineData = {
  found: boolean;
  priceEur: number | null;
  priceUsd: number | null;
  avg30dEur: number | null;
  lowestNmEur: number | null;
  trend: "rising" | "falling" | "stable" | null;
  source: string;
};

/** Compact price display — sits next to the card image in the modal hero */
export function LivePriceBadgeInline({ cardCode, cardName, overrideEur, overrideUsd }: {
  cardCode: string;
  cardName?: string;
  overrideEur?: number | null;
  overrideUsd?: number | null;
}) {
  const [data, setData] = useState<InlineData | null>(null);
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

  // Use override prices when a variant is selected, fall back to fetched data
  const hasOverride = overrideEur != null || overrideUsd != null;
  const displayEur = hasOverride ? (overrideEur ?? null) : (data?.priceEur ?? null);
  const displayUsd = hasOverride ? (overrideUsd ?? null) : (data?.priceUsd ?? null);
  const displayAvg = hasOverride ? null : (data?.avg30dEur ?? null);
  const displayTrend = hasOverride ? null : data?.trend;

  if (loading) {
    return (
      <div className="animate-pulse space-y-1">
        <div className="h-3 w-16 bg-[#E4E4E7] rounded" />
        <div className="h-6 w-20 bg-[#E4E4E7] rounded" />
      </div>
    );
  }

  if (!data?.found && !hasOverride) {
    return <div className="text-sm text-text-dim">No price data</div>;
  }

  if (!displayEur && !displayUsd) {
    return <div className="text-sm text-text-dim">No price data</div>;
  }

  const sourceLabel = config.region === "US" ? "TCGPlayer" : "Cardmarket";
  const sourceLogo = config.region === "US" ? "/logos/tcgplayer.svg" : "/logos/cardmarket.png";

  const trendColor = displayTrend === "rising" ? "text-[#059669]" : displayTrend === "falling" ? "text-[#DC2626]" : "text-text-dim";
  const trendIcon = displayTrend === "rising" ? "↑" : displayTrend === "falling" ? "↓" : "→";

  return (
    <div>
      {/* Source label */}
      <div className="flex items-center gap-1 mb-0.5">
        <img src={sourceLogo} alt={sourceLabel} className="h-[12px] opacity-50" />
        <span className="text-[11px] text-text-dim">{sourceLabel}</span>
      </div>

      {/* Hero price */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold text-[#059669]">
          {formatLocalPrice(displayEur, displayUsd)}
        </span>
        {displayTrend && (
          <span className={`text-xs font-semibold ${trendColor}`}>{trendIcon}</span>
        )}
      </div>

      {/* 30d avg underneath */}
      {displayAvg != null && config.region !== "US" && (
        <div className="text-[11px] text-text-dim mt-0.5">
          30d avg: <span className="font-mono">{formatLocalPrice(displayAvg, null)}</span>
        </div>
      )}
    </div>
  );
}
