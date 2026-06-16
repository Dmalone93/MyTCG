"use client";

import type { CollectionCard, CardPrice } from "./collection-shell";

function fmt(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
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
  const totalQty = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
  const totalSpent = cards.reduce(
    (s, c) => s + num(c.acquiredPrice) * (c.quantity ?? 1),
    0
  );
  const totalRaw = cards.reduce((s, c) => {
    const p = prices[c.cardCode];
    return s + num(p?.rawMarket) * (c.quantity ?? 1);
  }, 0);
  const totalGraded = cards.reduce((s, c) => {
    const p = prices[c.cardCode];
    const grade = c.grade ?? "PSA 10";
    const gp = (p?.gradedPrices as Record<string, number> | null)?.[grade] ?? 0;
    return s + gp * (c.quantity ?? 1);
  }, 0);

  const pl = totalRaw - totalSpent;
  const plPct = totalSpent > 0 ? (pl / totalSpent) * 100 : 0;
  const plColor = pl >= 0 ? "#059669" : "#F87171";
  const plBg = pl >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)";

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-xl overflow-hidden mb-3">
      <div className="px-3 sm:px-[18px] py-3 sm:py-[13px] border-r border-b sm:border-b-0 border-[rgba(0,0,0,0.04)] sm:flex-1 sm:min-w-[120px]">
        <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1 sm:mb-[7px]">
          Cards
        </div>
        <div className="font-mono font-semibold text-lg sm:text-[22px] tracking-tight">
          {cards.length}{" "}
          <span className="text-[10px] sm:text-xs text-text-dim font-medium">
            · {totalQty}x
          </span>
        </div>
      </div>

      {totalSpent > 0 && (
        <div className="px-3 sm:px-[18px] py-3 sm:py-[13px] sm:border-r border-b sm:border-b-0 border-[rgba(0,0,0,0.04)] sm:flex-1 sm:min-w-[120px]">
          <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1 sm:mb-[7px]">
            Spent
          </div>
          <div className="font-mono font-semibold text-lg sm:text-[22px] tracking-tight">
            {fmt(totalSpent)}
          </div>
        </div>
      )}

      {totalRaw > 0 && (
        <div className="px-3 sm:px-[18px] py-3 sm:py-[13px] border-r border-[rgba(0,0,0,0.04)] sm:flex-1 sm:min-w-[120px]">
          <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1 sm:mb-[7px]">
            Raw value
          </div>
          <div className="font-mono font-semibold text-lg sm:text-[22px] tracking-tight">
            {fmt(totalRaw)}
          </div>
        </div>
      )}

      {totalSpent > 0 && totalRaw > 0 && (
        <div className="px-3 sm:px-[18px] py-3 sm:py-[13px] sm:border-r border-[rgba(0,0,0,0.04)] sm:flex-1 sm:min-w-[140px]">
          <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1 sm:mb-[7px]">
            P/L
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span
              className="font-mono font-semibold text-lg sm:text-[22px] tracking-tight"
              style={{ color: plColor }}
            >
              {fmt(pl)}
            </span>
            <span
              className="font-mono font-semibold text-[10px] sm:text-xs px-1.5 sm:px-[7px] py-[2px] rounded-md"
              style={{ color: plColor, background: plBg }}
            >
              {plPct >= 0 ? "+" : ""}
              {plPct.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {totalGraded > 0 && (
        <div className="col-span-2 sm:col-span-1 px-3 sm:px-[18px] py-3 sm:py-[13px] border-t sm:border-t-0 border-[rgba(0,0,0,0.04)] sm:flex-1 sm:min-w-[120px]">
          <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1 sm:mb-[7px]">
            If graded · PSA 10
          </div>
          <div className="font-mono font-semibold text-lg sm:text-[22px] tracking-tight text-[#059669]">
            {fmt(totalGraded)}
          </div>
        </div>
      )}
    </div>
  );
}
