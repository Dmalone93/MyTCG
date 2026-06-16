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

  const items: React.ReactNode[] = [];

  if (totalSpent > 0) {
    items.push(
      <div key="spent" className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-text-dim">Spent</span>
        <div className="font-mono text-sm font-medium text-text">{fmt(totalSpent)}</div>
      </div>
    );
  }

  if (totalRaw > 0) {
    items.push(
      <div key="value" className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-text-dim">Value</span>
        <div className="font-mono text-sm font-medium text-text">{fmt(totalRaw)}</div>
      </div>
    );
  }

  if (totalSpent > 0 && totalRaw > 0) {
    items.push(
      <div key="pl" className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wider text-text-dim">P/L</span>
        <div className="font-mono text-sm font-medium" style={{ color: plColor }}>
          {fmt(pl)}
        </div>
        <div className="font-mono text-xs" style={{ color: plColor }}>
          {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start py-3">
      {items.map((item, i) => (
        <div key={i} className="contents">
          {i > 0 && <div className="w-px self-stretch bg-[rgba(0,0,0,0.08)] mx-4 sm:mx-6" />}
          {item}
        </div>
      ))}
    </div>
  );
}
