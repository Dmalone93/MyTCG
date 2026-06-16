"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "@/lib/charts/sparkline";

type PortfolioData = {
  points: Array<{ date: string; value: number }>;
  winners: Array<{ cardCode: string; current: number; change: number }>;
  losers: Array<{ cardCode: string; current: number; change: number }>;
  gradingOpps: Array<{ cardCode: string; raw: number; gradedPrice: number; grade: string; roi: number }>;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetched(true);
    fetch("/api/portfolio?range=30")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!fetched || loading) return null;
  if (!data || data.points.length < 2) return null;

  const values = data.points.map((p) => p.value);
  const current = values[values.length - 1];
  const previous = values[values.length - 2] ?? current;
  const dayChange = current - previous;
  const dayPct = previous > 0 ? (dayChange / previous) * 100 : 0;
  const isUp = dayChange >= 0;

  return (
    <div className="mb-4">
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 mb-2 w-full text-left">
        <span className="text-sm font-bold text-text">Portfolio</span>
        <span className="font-mono text-sm font-semibold text-text">{fmt(current)}</span>
        <span className={`font-mono text-sm font-semibold ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {isUp ? "+" : ""}{fmt(dayChange)} ({isUp ? "+" : ""}{dayPct.toFixed(1)}%)
        </span>
        <span className="text-text-dim text-xs ml-auto">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl p-4 space-y-4 expand-enter">
          <Sparkline data={values} height={80} />

          {(data.winners.length > 0 || data.losers.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {data.winners.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-text mb-2">Top gainers</div>
                  {data.winners.map((m) => (
                    <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-mono text-text-muted">{m.cardCode}</span>
                      <span className="font-mono font-semibold text-[#059669]">+{m.change}%</span>
                    </div>
                  ))}
                </div>
              )}
              {data.losers.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-text mb-2">Biggest drops</div>
                  {data.losers.map((m) => (
                    <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-mono text-text-muted">{m.cardCode}</span>
                      <span className="font-mono font-semibold text-[#DC2626]">{m.change}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {data.gradingOpps.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-text mb-2">Grading opportunities</div>
              {data.gradingOpps.map((g) => (
                <div key={g.cardCode} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="font-mono text-text-muted w-[80px]">{g.cardCode}</span>
                  <span className="text-text-dim">Raw {fmt(g.raw)}</span>
                  <span className="text-text-dim">→</span>
                  <span className="text-text">{g.grade} {fmt(g.gradedPrice)}</span>
                  <span className="font-mono font-semibold text-[#059669] ml-auto">+{g.roi}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
