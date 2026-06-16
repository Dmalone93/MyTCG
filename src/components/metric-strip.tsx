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

  if (totalSpent === 0 && totalRaw === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 stagger-children">
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3.5 text-center">
        <div className="text-sm text-text-dim mb-1">Spent</div>
        <div className="font-mono font-semibold text-base sm:text-lg tracking-tight">
          {totalSpent > 0 ? fmt(totalSpent) : "—"}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm px-4 py-3.5 text-center">
        <div className="text-sm text-text-dim mb-1">Raw Value</div>
        <div className="font-mono font-semibold text-base sm:text-lg tracking-tight">
          {totalRaw > 0 ? fmt(totalRaw) : "—"}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm px-4 py-3.5 text-center">
        <div className="text-sm text-text-dim mb-1">P/L</div>
        {totalSpent > 0 && totalRaw > 0 ? (
          <div>
            <span className="font-mono font-semibold text-base sm:text-lg tracking-tight" style={{ color: plColor }}>
              {fmt(pl)}
            </span>
            <div>
              <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded-full" style={{ color: plColor, background: plBg }}>
                {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="font-mono font-semibold text-base sm:text-lg tracking-tight text-text-dim">—</div>
        )}
      </div>
    </div>
  );
}
