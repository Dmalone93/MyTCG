"use client";

import { useEffect, useState } from "react";
import { InteractiveChart } from "./interactive-chart";
import { useRegion } from "@/components/region-selector";

type PricePoint = { price: number; date: string };
type Range = "7" | "30" | "90" | "365";

export function PriceChart({ cardCode }: { cardCode: string }) {
  const [range, setRange] = useState<Range>("30");
  const { formatPrice } = useRegion();
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
    return null;
  }

  const isUp = data.change >= 0;

  return (
    <div className="bg-bg-surface rounded-xl p-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-lg font-semibold text-text">{formatPrice(data.current)}</span>
        <span className={`font-mono text-sm font-semibold ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {isUp ? "+" : ""}{data.change.toFixed(1)}%
        </span>
        <div className="flex-1" />
        <span className="text-xs text-text-dim">H {formatPrice(data.high)}</span>
        <span className="text-xs text-text-dim">L {formatPrice(data.low)}</span>
      </div>

      <InteractiveChart
        data={data.points.map((p) => ({
          value: p.price,
          label: new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        }))}
        height={100}
        formatValue={formatPrice}
      />

      <div className="flex gap-1 mt-3">
        {(["7", "30", "90", "365"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 text-sm rounded-lg transition-colors ${
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
