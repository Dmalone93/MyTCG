"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRegion } from "@/components/region-selector";
import { Sparkline } from "@/lib/charts/sparkline";

type CollectionSummary = {
  id: string;
  name: string;
  createdAt: Date | null;
  cardCount: number;
  thumbnails: string[];
  totalValue: number;
};

type IntelItem = {
  id: string;
  title: string | null;
  summary: string | null;
  category: string | null;
  source: string | null;
  author: string | null;
  imageUrl: string | null;
  fetchedAt: Date | null;
};

type Deal = {
  id: string;
  cardCode: string;
  cardName: string;
  currentPrice: string;
  avgPrice: string;
  discountPct: string;
  imageUrl: string | null;
};

type PortfolioData = {
  points: Array<{ date: string; value: number }>;
  winners: Array<{ cardCode: string; current: number; change: number }>;
  losers: Array<{ cardCode: string; current: number; change: number }>;
};

// Categories that should show even without an image (new drops, promos, products)
const DROP_CATEGORIES = ["new releases", "products", "promos", "sets", "pre-orders"];

export function HomeDashboard({
  collections,
  portfolioValue,
  portfolioSpent,
  recentIntel,
  recentDeals,
}: {
  collections: CollectionSummary[];
  portfolioValue: number;
  portfolioSpent: number;
  recentIntel: IntelItem[];
  recentDeals: Deal[];
}) {
  const { formatPrice } = useRegion();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  useEffect(() => {
    fetch("/api/portfolio?range=30")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPortfolio(d); })
      .catch(() => {});
  }, []);

  const totalCards = collections.reduce((s, c) => s + (c.cardCount ?? 0), 0);
  const pl = portfolioValue - portfolioSpent;
  const plPct = portfolioSpent > 0 ? (pl / portfolioSpent) * 100 : 0;

  // Filter intel: must have image OR be a drop/promo category
  const filteredIntel = recentIntel.filter((item) => {
    if (item.imageUrl) return true;
    const cat = (item.category ?? "").toLowerCase();
    return DROP_CATEGORIES.some((dc) => cat.includes(dc));
  });

  return (
    <div className="space-y-6">
      {/* Portfolio hero */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Portfolio value</div>
        <div className="font-mono text-3xl font-bold text-text">
          {portfolioValue > 0 ? formatPrice(portfolioValue) : "—"}
        </div>
        {portfolioSpent > 0 && portfolioValue > 0 && (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-text-dim">Spent {formatPrice(portfolioSpent)}</span>
            <span className={`font-mono text-sm font-semibold ${pl >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {pl >= 0 ? "+" : ""}{formatPrice(pl)} ({pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
            </span>
          </div>
        )}
        {portfolio && portfolio.points.length > 2 && (
          <div className="mt-3">
            <Sparkline data={portfolio.points.map((p) => p.value)} height={60} />
          </div>
        )}
      </div>

      {/* Your collections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-dim uppercase tracking-wider">Your collections</span>
          <Link href="/collections" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">View all</Link>
        </div>
        {collections.length > 0 ? (
          <div className="space-y-2">
            {collections.map((col) => (
              <Link
                key={col.id}
                href="/collections"
                className="flex items-center gap-3 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl px-4 py-3.5 hover:bg-[rgba(0,0,0,0.03)] active:opacity-80 transition-colors"
              >
                {/* Card thumbnails — stacked/overlapping */}
                <div className="flex -space-x-2 flex-none">
                  {col.thumbnails.length > 0 ? (
                    col.thumbnails.map((img, i) => (
                      <div key={i} className="w-8 aspect-[2.5/3.5] rounded-md overflow-hidden bg-[#E4E4E7] border-2 border-bg-surface" style={{ zIndex: 3 - i }}>
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3v4M8 3v4"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{col.name}</div>
                  <div className="text-xs text-text-dim">{col.cardCount} cards</div>
                </div>
                {col.totalValue > 0 && (
                  <span className="font-mono text-sm font-semibold text-[#059669] flex-none mr-1">{formatPrice(col.totalValue)}</span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/collections"
            className="flex flex-col items-center justify-center bg-bg-surface border border-dashed border-[rgba(0,0,0,0.12)] rounded-2xl py-8 hover:bg-[rgba(0,0,0,0.02)] active:opacity-70 transition-colors"
          >
            <div className="text-sm text-text-dim mb-1">No collections yet</div>
            <div className="text-sm font-medium text-text">Create your first collection</div>
          </Link>
        )}
      </div>

      {/* Price movers */}
      {portfolio && (portfolio.winners.length > 0 || portfolio.losers.length > 0) && (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Price movers</div>
          <div className="grid grid-cols-2 gap-3">
            {portfolio.winners.length > 0 && (
              <div className="bg-bg-surface rounded-2xl p-3">
                <div className="text-xs text-text-dim mb-2">Gainers</div>
                {portfolio.winners.slice(0, 3).map((m) => (
                  <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-mono text-text-muted truncate mr-2">{m.cardCode}</span>
                    <span className="font-mono font-semibold text-[#059669] flex-none">+{m.change}%</span>
                  </div>
                ))}
              </div>
            )}
            {portfolio.losers.length > 0 && (
              <div className="bg-bg-surface rounded-2xl p-3">
                <div className="text-xs text-text-dim mb-2">Drops</div>
                {portfolio.losers.slice(0, 3).map((m) => (
                  <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-mono text-text-muted truncate mr-2">{m.cardCode}</span>
                    <span className="font-mono font-semibold text-[#DC2626] flex-none">{m.change}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deals */}
      {recentDeals.length > 0 && (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Deals</div>
          <div className="space-y-1.5">
            {recentDeals.map((deal) => (
              <div key={deal.id} className="flex items-center gap-3 bg-bg-surface rounded-xl px-3 py-2.5">
                {deal.imageUrl && (
                  <div className="w-8 aspect-[2.5/3.5] rounded overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={deal.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{deal.cardName}</div>
                  <div className="text-xs text-text-dim">{deal.cardCode}</div>
                </div>
                <div className="text-right flex-none">
                  <div className="font-mono text-sm font-semibold text-[#059669]">{formatPrice(Number(deal.currentPrice))}</div>
                  <div className="font-mono text-xs text-text-dim">avg {formatPrice(Number(deal.avgPrice))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest news — rich cards */}
      {filteredIntel.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-dim uppercase tracking-wider">Latest news</span>
            <Link href="/intel" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">See all</Link>
          </div>
          <div className="space-y-3">
            {filteredIntel.map((item, i) => (
              <Link
                key={item.id}
                href="/intel"
                className="block bg-bg-surface rounded-2xl overflow-hidden hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors border border-[rgba(0,0,0,0.04)]"
              >
                {/* Hero image — first item gets large, rest get compact */}
                {item.imageUrl && (
                  <div className={`w-full bg-[#E4E4E7] overflow-hidden ${i === 0 ? "aspect-[16/9]" : "aspect-[3/1]"}`}>
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                    />
                  </div>
                )}
                <div className="px-4 py-3">
                  {item.category && (
                    <div className="text-xs text-text-dim uppercase tracking-wider mb-1">{item.category}</div>
                  )}
                  <div className="text-sm font-semibold text-text mb-1 line-clamp-2">{item.title}</div>
                  {item.summary && (
                    <div className="text-sm text-text-muted line-clamp-2 mb-2">{item.summary}</div>
                  )}
                  {(item.source || item.author) && (
                    <div className="text-xs text-text-dim">
                      {item.source}{item.author ? ` · ${item.author}` : ""}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex items-center justify-between text-xs text-text-dim py-2 border-t border-[rgba(0,0,0,0.06)]">
        <span>{totalCards} cards across {collections.length} collection{collections.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
