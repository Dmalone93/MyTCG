"use client";

import { useEffect, useState } from "react";

type Deal = {
  cardCode: string;
  cardName: string;
  currentPrice: number;
  avgPrice: number;
  discountPct: number;
  imageUrl: string | null;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

const RETAILERS = [
  { name: "Total Cards", url: (q: string) => `https://www.totalcards.net/search?q=${encodeURIComponent(q)}` },
  { name: "Chaos Cards", url: (q: string) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}` },
  { name: "Cardmarket", url: (q: string) => `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(q)}` },
];

export function DealAlerts() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.deals) setDeals(d.deals); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || deals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-text mb-3">Deals — cards below market average</div>
      <div className="space-y-2">
        {deals.map((deal) => (
          <div key={deal.cardCode} className="flex items-center gap-3 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl p-3">
            {deal.imageUrl && (
              <div className="w-10 h-[56px] rounded-md overflow-hidden bg-[#E4E4E7] flex-none">
                <img src={deal.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text truncate">{deal.cardName}</div>
              <div className="flex items-center gap-2 text-sm mt-0.5">
                <span className="font-mono font-semibold text-[#059669]">{fmt(deal.currentPrice)}</span>
                <span className="font-mono text-text-dim line-through">{fmt(deal.avgPrice)}</span>
                <span className="text-xs font-semibold text-[#059669] bg-[rgba(5,150,105,0.08)] px-1.5 py-0.5 rounded">-{deal.discountPct}%</span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-none">
              {RETAILERS.map((r) => (
                <a key={r.name} href={r.url(deal.cardName)} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-text-dim hover:text-text border border-[rgba(0,0,0,0.06)] rounded px-2 py-1 transition-colors">
                  {r.name.split(" ")[0]}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
