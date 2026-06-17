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
};

type IntelItem = {
  id: string;
  title: string | null;
  category: string | null;
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

export function HomeDashboard({
  collections,
  recentIntel,
  recentDeals,
}: {
  collections: CollectionSummary[];
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
  const portfolioValue = portfolio?.points?.length ? portfolio.points[portfolio.points.length - 1].value : null;
  const prevValue = portfolio?.points?.length && portfolio.points.length > 1 ? portfolio.points[portfolio.points.length - 2].value : null;
  const dayChange = portfolioValue != null && prevValue != null ? portfolioValue - prevValue : null;
  const dayPct = dayChange != null && prevValue ? (dayChange / prevValue) * 100 : null;
  const isUp = dayChange != null ? dayChange >= 0 : true;

  return (
    <div className="space-y-6">
      {/* Portfolio hero */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Portfolio value</div>
        {portfolioValue != null ? (
          <div>
            <div className="font-mono text-3xl font-bold text-text">{formatPrice(portfolioValue)}</div>
            {dayChange != null && (
              <div className={`font-mono text-sm font-semibold mt-0.5 ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {isUp ? "+" : ""}{formatPrice(dayChange)} ({isUp ? "+" : ""}{dayPct?.toFixed(1)}%)
              </div>
            )}
            {portfolio && portfolio.points.length > 2 && (
              <div className="mt-3">
                <Sparkline data={portfolio.points.map((p) => p.value)} height={60} />
              </div>
            )}
          </div>
        ) : (
          <div className="font-mono text-3xl font-bold text-text-dim">—</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Link href="/search" className="flex-1 flex items-center justify-center gap-2 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl py-3 text-sm font-medium text-text hover:bg-[rgba(0,0,0,0.04)] active:opacity-70 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Search
        </Link>
        <Link href="/browse" className="flex-1 flex items-center justify-center gap-2 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl py-3 text-sm font-medium text-text hover:bg-[rgba(0,0,0,0.04)] active:opacity-70 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Browse
        </Link>
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
                <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-[rgba(0,0,0,0.06)] flex items-center justify-center flex-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3v4M8 3v4"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{col.name}</div>
                  <div className="text-xs text-text-dim">{col.cardCount} cards</div>
                </div>
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

      {/* News headlines */}
      {recentIntel.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-dim uppercase tracking-wider">Latest news</span>
            <Link href="/intel" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">See all</Link>
          </div>
          <div className="space-y-1.5">
            {recentIntel.map((item) => (
              <Link
                key={item.id}
                href="/intel"
                className="flex items-center gap-3 bg-bg-surface rounded-xl px-3 py-2.5 hover:bg-[rgba(0,0,0,0.03)] active:opacity-80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{item.title}</div>
                  {item.category && <div className="text-xs text-text-dim uppercase">{item.category}</div>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
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
