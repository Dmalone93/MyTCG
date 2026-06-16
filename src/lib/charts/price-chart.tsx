"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "./sparkline";

type PricePoint = { price: number; date: string };
type Range = "7" | "30" | "90" | "365";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}

export function PriceChart({ cardCode }: { cardCode: string }) {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<{
    points: PricePoint[];
    high: number;
    low: number;
    current: number;
    change: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/price-history?code=${encodeURIComponent(cardCode)}&range=${range}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardCode, range]);

  if (loading) {
    return <div className="h-[120px] bg-bg-surface rounded-lg animate-pulse" />;
  }

  if (!data || data.points.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center text-sm text-text-dim bg-bg-surface rounded-lg">
        Not enough price data yet
      </div>
    );
  }

  const prices = data.points.map((p) => p.price);
  const isUp = data.change >= 0;

  return (
    <div className="bg-bg-surface rounded-lg p-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-lg font-semibold text-text">{fmt(data.current)}</span>
        <span className={`font-mono text-sm font-semibold ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {isUp ? "+" : ""}{data.change}%
        </span>
        <div className="flex-1" />
        <span className="text-sm text-text-dim">H {fmt(data.high)}</span>
        <span className="text-sm text-text-dim">L {fmt(data.low)}</span>
      </div>

      <Sparkline data={prices} height={80} />

      <div className="flex gap-1 mt-3">
        {(["7", "30", "90", "365"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 text-sm rounded transition-colors ${
              range === r
                ? "bg-text text-bg font-semibold"
                : "text-text-dim hover:text-text"
            }`}
          >
            {r === "365" ? "All" : `${r}d`}
          </button>
        ))}
      </div>
    </div>
  );
}
