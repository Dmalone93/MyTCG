"use client";

import type { CollectionCard, CardPrice } from "./collection-shell";

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

export function MetricStrip({
  cards,
  prices,
}: {
  cards: CollectionCard[];
  prices: Record<string, CardPrice>;
}) {
  const totalSpent = cards.reduce(
    (s, c) => s + num(c.acquiredPrice) * (c.quantity ?? 1),
    0
  );
  const totalRaw = cards.reduce((s, c) => {
    const p = prices[c.cardCode];
    return s + num(p?.rawMarket) * (c.quantity ?? 1);
  }, 0);

  const pl = totalRaw - totalSpent;
  const plPct = totalSpent > 0 ? (pl / totalSpent) * 100 : 0;
  const plColor = pl >= 0 ? "#059669" : "#DC2626";
  const plBg = pl >= 0 ? "rgba(5,150,105,0.08)" : "rgba(220,38,38,0.08)";

  // Don't show if no data
  if (totalSpent === 0 && totalRaw === 0) return null;

  return (
    <div className="flex items-stretch bg-bg-elevated rounded-2xl shadow-sm overflow-hidden mb-4 stagger-children">
      {totalSpent > 0 && (
        <div className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4 border-r border-[rgba(0,0,0,0.04)]">
          <div className="text-sm text-text-dim mb-1">Spent</div>
          <div className="font-mono font-semibold text-lg sm:text-xl tracking-tight">
            {fmt(totalSpent)}
          </div>
        </div>
      )}

      {totalRaw > 0 && (
        <div className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4 border-r border-[rgba(0,0,0,0.04)]">
          <div className="text-sm text-text-dim mb-1">Raw Value</div>
          <div className="font-mono font-semibold text-lg sm:text-xl tracking-tight">
            {fmt(totalRaw)}
          </div>
        </div>
      )}

      {totalSpent > 0 && totalRaw > 0 && (
        <div className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4">
          <div className="text-sm text-text-dim mb-1">P/L</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono font-semibold text-lg sm:text-xl tracking-tight" style={{ color: plColor }}>
              {fmt(pl)}
            </span>
            <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded-full" style={{ color: plColor, background: plBg }}>
              {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
