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
  const [showQR, setShowQR] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portfolio?range=30")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPortfolio(d); })
      .catch(() => {});
  }, []);

  const totalCards = collections.reduce((s, c) => s + (c.cardCount ?? 0), 0);
  const pl = portfolioValue - portfolioSpent;
  const plPct = portfolioSpent > 0 ? (pl / portfolioSpent) * 100 : 0;

  const filteredIntel = recentIntel.filter((item) => {
    if (item.imageUrl) return true;
    const cat = (item.category ?? "").toLowerCase();
    return DROP_CATEGORIES.some((dc) => cat.includes(dc));
  });

  return (
    <div className="space-y-8">

      {/* ═══ PORTFOLIO HERO ═══ */}
      <section className="bg-bg-surface rounded-2xl p-5 border border-[rgba(0,0,0,0.04)]">
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Portfolio value</div>
        <div className="font-mono text-4xl font-bold text-text leading-tight">
          {portfolioValue > 0 ? formatPrice(portfolioValue) : "—"}
        </div>
        {portfolioSpent > 0 && portfolioValue > 0 && (
          <div className="flex items-center gap-4 mt-2">
            <div>
              <div className="text-xs text-text-dim">Spent</div>
              <div className="font-mono text-sm text-text">{formatPrice(portfolioSpent)}</div>
            </div>
            <div className="w-px h-8 bg-[rgba(0,0,0,0.08)]" />
            <div>
              <div className="text-xs text-text-dim">P/L</div>
              <div className={`font-mono text-sm font-semibold ${pl >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {pl >= 0 ? "+" : ""}{formatPrice(pl)} ({pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        )}
        {portfolio && portfolio.points.length > 2 && (
          <div className="mt-4">
            <Sparkline data={portfolio.points.map((p) => p.value)} height={60} />
          </div>
        )}
        <div className="text-xs text-text-dim mt-3">
          {totalCards} cards across {collections.length} collection{collections.length !== 1 ? "s" : ""}
        </div>
      </section>

      {/* ═══ QUICK ACTIONS ═══ */}
      <section className="grid grid-cols-3 gap-2">
        <Link href="/search" className="flex flex-col items-center gap-1.5 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl py-4 text-text-dim hover:text-text active:opacity-70 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="text-xs font-medium">Search</span>
        </Link>
        <Link href="/browse" className="flex flex-col items-center gap-1.5 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl py-4 text-text-dim hover:text-text active:opacity-70 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span className="text-xs font-medium">Browse</span>
        </Link>
        <Link href="/intel" className="flex flex-col items-center gap-1.5 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl py-4 text-text-dim hover:text-text active:opacity-70 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span className="text-xs font-medium">News</span>
        </Link>
      </section>

      {/* ═══ YOUR COLLECTIONS ═══ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wide">Your collections</h2>
          <Link href="/collections" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">View all</Link>
        </div>
        {collections.length > 0 ? (
          <div className="space-y-2.5">
            {collections.map((col) => (
              <div key={col.id} className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
                <Link
                  href={`/collections?id=${col.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
                >
                  {/* Thumbnails */}
                  <div className="flex -space-x-2 flex-none">
                    {col.thumbnails.length > 0 ? (
                      col.thumbnails.map((img, i) => (
                        <div key={i} className="w-9 aspect-[63/88] rounded-lg overflow-hidden bg-[#E4E4E7] border-2 border-bg-surface" style={{ zIndex: 3 - i }}>
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
                    <div className="text-sm font-semibold text-text truncate">{col.name}</div>
                    <div className="text-xs text-text-dim">{col.cardCount} cards</div>
                  </div>
                  {col.totalValue > 0 && (
                    <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(col.totalValue)}</span>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim flex-none">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
                {/* Share button */}
                <div className="border-t border-[rgba(0,0,0,0.04)] px-4 py-2 flex justify-end">
                  <button
                    onClick={() => setShowQR(col.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-text-dim hover:text-text active:opacity-70 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3"/><path d="M20 14v3h-3"/><path d="M14 20h3"/><path d="M20 20h0"/>
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Link
            href="/collections"
            className="flex flex-col items-center justify-center bg-bg-surface border border-dashed border-[rgba(0,0,0,0.12)] rounded-2xl py-10 hover:bg-[rgba(0,0,0,0.02)] active:opacity-70 transition-colors"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-3">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3v4M8 3v4"/>
            </svg>
            <div className="text-sm text-text-dim mb-1">No collections yet</div>
            <div className="text-sm font-medium text-text">Create your first collection</div>
          </Link>
        )}
      </section>

      {/* ═══ PRICE MOVERS ═══ */}
      {portfolio && (portfolio.winners.length > 0 || portfolio.losers.length > 0) && (
        <section>
          <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-4">Price movers</h2>
          <div className="grid grid-cols-2 gap-3">
            {portfolio.winners.length > 0 && (
              <div className="bg-bg-surface border border-[rgba(0,0,0,0.04)] rounded-2xl p-4">
                <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Gainers</div>
                {portfolio.winners.slice(0, 3).map((m) => (
                  <div key={m.cardCode} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-mono text-text-muted truncate mr-2">{m.cardCode}</span>
                    <span className="font-mono font-semibold text-[#059669] flex-none">+{m.change}%</span>
                  </div>
                ))}
              </div>
            )}
            {portfolio.losers.length > 0 && (
              <div className="bg-bg-surface border border-[rgba(0,0,0,0.04)] rounded-2xl p-4">
                <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Drops</div>
                {portfolio.losers.slice(0, 3).map((m) => (
                  <div key={m.cardCode} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-mono text-text-muted truncate mr-2">{m.cardCode}</span>
                    <span className="font-mono font-semibold text-[#DC2626] flex-none">{m.change}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ DEALS ═══ */}
      {recentDeals.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-4">Deals</h2>
          <div className="space-y-2">
            {recentDeals.map((deal) => (
              <div key={deal.id} className="flex items-center gap-3 bg-bg-surface border border-[rgba(0,0,0,0.04)] rounded-2xl px-4 py-3">
                {deal.imageUrl && (
                  <div className="w-9 aspect-[63/88] rounded-lg overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={deal.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{deal.cardName}</div>
                  <div className="text-xs text-text-dim font-mono">{deal.cardCode}</div>
                </div>
                <div className="text-right flex-none">
                  <div className="font-mono text-sm font-semibold text-[#059669]">{formatPrice(Number(deal.currentPrice))}</div>
                  <div className="font-mono text-xs text-text-dim">avg {formatPrice(Number(deal.avgPrice))}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ LATEST NEWS ═══ */}
      {filteredIntel.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text uppercase tracking-wide">Latest news</h2>
            <Link href="/intel" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">See all</Link>
          </div>
          <div className="space-y-3">
            {filteredIntel.map((item, i) => (
              <Link
                key={item.id}
                href="/intel"
                className="block bg-bg-surface rounded-2xl overflow-hidden hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors border border-[rgba(0,0,0,0.04)]"
              >
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
                  {item.summary && i === 0 && (
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
        </section>
      )}

      {/* ═══ QR SHARE MODAL ═══ */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-bg-elevated rounded-2xl p-6 w-full max-w-xs text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text mb-1">Share collection</h3>
            <p className="text-sm text-text-dim mb-4">Scan to view this collection</p>
            <div className="bg-white rounded-xl p-4 mb-4 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  typeof window !== "undefined" ? `${window.location.origin}/share/${showQR}` : `/share/${showQR}`
                )}`}
                alt="QR Code"
                className="w-[200px] h-[200px]"
              />
            </div>
            <div className="text-xs text-text-dim mb-4 font-mono break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/share/${showQR}` : `/share/${showQR}`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/share/${showQR}`;
                  navigator.clipboard.writeText(url);
                }}
                className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70 transition-colors"
              >
                Copy link
              </button>
              <button
                onClick={() => setShowQR(null)}
                className="flex-1 text-sm font-medium text-text-muted hover:text-text py-2.5 active:opacity-70"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
