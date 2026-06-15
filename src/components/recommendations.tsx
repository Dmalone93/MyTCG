"use client";

import { useEffect, useState } from "react";

type Recommendation = {
  cardSetId: string;
  cardName: string;
  type: string;
  color: string;
  rarity: string;
  traits: string;
  power: number | null;
  cost: number | null;
  imageUrl: string;
  setName: string;
  altArt: string | null;
  effect: string;
  marketPrice: number | null;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export function Recommendations() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [fetched, setFetched] = useState(false);

  function loadRecs() {
    if (fetched) return;
    setLoading(true);
    setFetched(true);
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((data) => {
        setRecs(data.recommendations ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          if (!next) loadRecs();
        }}
        className="flex items-center gap-2 mb-2 group"
      >
        <h2 className="font-bold text-sm sm:text-base text-text">Recommended for you</h2>
        <span className="text-text-dim text-xs group-hover:text-text transition-colors">
          {collapsed ? "▸" : "▾"}
        </span>
        {recs.length > 0 && (
          <span className="text-[10px] font-mono text-text-dim">
            {recs.length} cards
          </span>
        )}
      </button>

      {!collapsed && loading && (
        <div className="py-6 text-center text-text-dim text-sm">Loading recommendations...</div>
      )}
      {!collapsed && !loading && recs.length === 0 && fetched && (
        <div className="py-4 text-center text-text-dim text-xs">Add more cards to get recommendations</div>
      )}
      {!collapsed && recs.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
          {recs.map((rec) => (
            <div
              key={rec.cardSetId}
              className="flex-none w-[140px] sm:w-[160px] bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden snap-start"
            >
              <div className="aspect-[2.5/3.5] bg-[#1C1C1F] relative">
                <img
                  src={rec.imageUrl}
                  alt={rec.cardName}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {rec.altArt && (
                  <div className="absolute top-1.5 right-1.5 bg-black/70 text-[8px] font-mono text-yellow-400 px-1.5 py-0.5 rounded">
                    ALT
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="font-mono text-[10px] text-text-dim mb-0.5">
                  {rec.cardSetId}
                </div>
                <div className="font-semibold text-xs text-text truncate mb-1">
                  {rec.cardName}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-text-dim">
                    {rec.rarity}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-text-dim">
                    {rec.color}
                  </span>
                </div>
                {rec.marketPrice != null && rec.marketPrice > 0 && (
                  <div className="font-mono text-[11px] text-[#4ADE80] font-semibold mt-1">
                    {fmt(rec.marketPrice)}
                  </div>
                )}
                {rec.traits && (
                  <div className="text-[9px] text-text-dim mt-0.5 truncate">
                    {rec.traits}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
