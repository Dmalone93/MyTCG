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
    <div className="flex items-baseline gap-4 sm:gap-6 py-2 flex-wrap">
      {totalSpent > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-[.15em] text-text-dim mb-0.5">Spent</div>
          <div className="font-mono font-semibold text-lg tracking-tight">{fmt(totalSpent)}</div>
        </div>
      )}
      {totalRaw > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-[.15em] text-text-dim mb-0.5">Value</div>
          <div className="font-mono font-semibold text-lg tracking-tight">{fmt(totalRaw)}</div>
        </div>
      )}
      {totalSpent > 0 && totalRaw > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-[.15em] text-text-dim mb-0.5">P/L</div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-lg tracking-tight" style={{ color: plColor }}>
              {fmt(pl)}
            </span>
            <span className="font-mono font-semibold text-xs" style={{ color: plColor }}>
              {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
