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

  if (totalSpent === 0 && totalRaw === 0) return null;

  return (
    <div className="flex items-center gap-5 py-2 text-sm">
      {totalSpent > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim tracking-wide">Spent</span>
          <span className="font-mono font-medium text-text">{fmt(totalSpent)}</span>
        </div>
      )}
      {totalRaw > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim tracking-wide">Value</span>
          <span className="font-mono font-medium text-text">{fmt(totalRaw)}</span>
        </div>
      )}
      {totalSpent > 0 && totalRaw > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim tracking-wide">P/L</span>
          <span className="font-mono font-medium" style={{ color: plColor }}>
            {fmt(pl)}
          </span>
          <span className="font-mono text-xs" style={{ color: plColor }}>
            {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
