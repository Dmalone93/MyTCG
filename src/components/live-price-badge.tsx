"use client";

import { useEffect, useState } from "react";
import { useRegion } from "./region-selector";

type LivePrice = {
  found: boolean;
  price: number | null;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  avg30d: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  allTimeLow: number | null;
  trend: "rising" | "falling" | "stable" | null;
  variants: Array<{
    condition: string;
    printing: string;
    price: number | null;
    change7d: number | null;
    change30d: number | null;
  }>;
};

export function LivePriceBadge({ cardCode, cardName }: { cardCode: string; cardName?: string }) {
  const [data, setData] = useState<LivePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const { config } = useRegion();

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

  if (loading) return <div className="h-[120px] bg-bg-surface rounded-lg animate-pulse" />;
  if (!data?.found || !data.price) return null;

  const fmtPrice = (usd: number | null) => {
    if (usd == null) return "—";
    const converted = usd * config.rate;
    return `${config.symbol}${converted.toFixed(2)}`;
  };

  const trendColor = data.trend === "rising" ? "text-[#059669]" : data.trend === "falling" ? "text-[#DC2626]" : "text-text-muted";
  const trendLabel = data.trend === "rising" ? "↑ Rising" : data.trend === "falling" ? "↓ Falling" : "→ Stable";

  return (
    <div className="bg-bg-surface rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">Live Market Price</span>
        <span className="text-xs text-text-dim">via JustTCG</span>
      </div>

      {/* Main price + trend */}
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xl font-bold text-text">{fmtPrice(data.price)}</span>
        {data.trend && <span className={`text-sm font-semibold ${trendColor}`}>{trendLabel}</span>}
      </div>

      {/* Changes */}
      <div className="flex gap-4 text-sm">
        {data.change7d != null && (
          <div>
            <div className="text-xs text-text-dim">7d</div>
            <div className={`font-mono font-semibold ${data.change7d >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {data.change7d >= 0 ? "+" : ""}{data.change7d.toFixed(1)}%
            </div>
          </div>
        )}
        {data.change30d != null && (
          <div>
            <div className="text-xs text-text-dim">30d</div>
            <div className={`font-mono font-semibold ${data.change30d >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {data.change30d >= 0 ? "+" : ""}{data.change30d.toFixed(1)}%
            </div>
          </div>
        )}
        {data.change90d != null && (
          <div>
            <div className="text-xs text-text-dim">90d</div>
            <div className={`font-mono font-semibold ${data.change90d >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {data.change90d >= 0 ? "+" : ""}{data.change90d.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Range */}
      {(data.yearHigh || data.yearLow) && (
        <div className="flex gap-4 text-sm">
          {data.yearLow != null && (
            <div>
              <div className="text-xs text-text-dim">52w Low</div>
              <div className="font-mono text-text">{fmtPrice(data.yearLow)}</div>
            </div>
          )}
          {data.yearHigh != null && (
            <div>
              <div className="text-xs text-text-dim">52w High</div>
              <div className="font-mono text-text">{fmtPrice(data.yearHigh)}</div>
            </div>
          )}
          {data.avg30d != null && (
            <div>
              <div className="text-xs text-text-dim">30d Avg</div>
              <div className="font-mono text-text">{fmtPrice(data.avg30d)}</div>
            </div>
          )}
        </div>
      )}

      {/* Variant prices */}
      {data.variants.length > 1 && (
        <div>
          <div className="text-xs text-text-dim mb-1.5">Variants</div>
          <div className="space-y-1">
            {data.variants.slice(0, 5).map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{v.printing} · {v.condition}</span>
                <span className="font-mono text-text">{fmtPrice(v.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
