"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRegion } from "@/components/region-selector";
import { InteractiveChart } from "@/lib/charts/interactive-chart";
import { CardDataSheet } from "@/components/card-data-sheet";

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
  topCards,
  recentlyAdded,
  setCompletion,
  recentIntel,
  recentDeals,
}: {
  collections: CollectionSummary[];
  portfolioValue: number;
  portfolioSpent: number;
  topCards: Array<{ code: string; name: string; imageUrl: string | null; value: number }>;
  recentlyAdded: Array<{ code: string; name: string; imageUrl: string | null; price: number }>;
  setCompletion: Array<{ setId: string; owned: number; total: number }>;
  recentIntel: IntelItem[];
  recentDeals: Deal[];
}) {
  const { formatPrice } = useRegion();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [viewCard, setViewCard] = useState<{ code: string; name: string; imageUrl: string | null; value: number } | null>(null);

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
    <div className="space-y-6">

      {/* ═══ PORTFOLIO HERO — white card with integrated chart ═══ */}
      <section className="bg-white rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.06)] sm:rounded-3xl">
        {/* Top section — value + stats */}
        <div className="px-5 pt-5 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Portfolio value</div>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-3xl sm:text-5xl font-bold text-text">
              {portfolioValue > 0 ? formatPrice(portfolioValue) : "—"}
            </span>
            {portfolioSpent > 0 && portfolioValue > 0 && (
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${
                pl >= 0 ? "bg-[#059669]/10 text-[#059669]" : "bg-[#DC2626]/10 text-[#DC2626]"
              }`}>
                {pl >= 0 ? "↑" : "↓"} {Math.abs(plPct).toFixed(1)}%
              </span>
            )}
            <div className="flex-1" />
            <span className="text-xs text-text-dim">Last 30 days</span>
          </div>
          {/* Stats row */}
          <div className="flex border-t border-[rgba(0,0,0,0.06)] pt-3 sm:pt-4">
            <div className="flex-1 text-center border-r border-[rgba(0,0,0,0.06)]">
              <div className="font-mono text-sm font-semibold text-text">{totalCards} Cards</div>
            </div>
            <div className="flex-1 text-center border-r border-[rgba(0,0,0,0.06)]">
              <div className="font-mono text-sm font-semibold text-text">{collections.length} Collection{collections.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="font-mono text-sm font-semibold text-text">
                {portfolioSpent > 0 ? formatPrice(portfolioSpent) : "—"}
              </div>
              <div className="text-[10px] text-text-dim">Spent</div>
            </div>
          </div>
        </div>
        {/* Chart — integrated into the card */}
        <div className="px-3 pb-3 sm:px-6 sm:pb-6">
          {portfolio && portfolio.points.length > 2 ? (
            <InteractiveChart
              data={portfolio.points.map((p) => ({
                value: p.value,
                label: new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
              }))}
              height={180}
              color="#059669"
              negativeColor="#DC2626"
              formatValue={formatPrice}
            />
          ) : portfolioValue > 0 ? (
            <InteractiveChart
              data={Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const nudge = [0.97, 0.98, 0.96, 0.99, 0.98, 0.995, 1][i];
                return {
                  value: portfolioValue * nudge,
                  label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                };
              })}
              height={180}
              color="#059669"
              negativeColor="#DC2626"
              formatValue={formatPrice}
            />
          ) : (
            <div className="h-[100px] bg-bg-surface rounded-xl flex items-center justify-center">
              <span className="text-xs text-text-dim">Add cards to see your portfolio chart</span>
            </div>
          )}
        </div>
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
              <div key={col.id} className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
                <Link
                  href={`/collections?id=${col.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
                >
                  {/* Mobile only: 4 stacked thumbnails */}
                  <div className="flex -space-x-1.5 flex-none sm:hidden">
                    {col.thumbnails.length > 0 ? (
                      col.thumbnails.slice(0, 4).map((img, i) => (
                        <div key={i} className="w-7 aspect-[63/88] rounded-md overflow-hidden bg-[#E4E4E7] border-2 border-white" style={{ zIndex: 4 - i }}>
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-bg-surface border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
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
                {/* Desktop only: bigger card preview row */}
                {col.thumbnails.length > 0 && (
                  <div className="hidden sm:flex gap-2 px-4 pb-4 overflow-x-auto">
                    {col.thumbnails.map((img, i) => (
                      <div key={i} className="w-[72px] aspect-[63/88] rounded-xl overflow-hidden bg-[#E4E4E7] flex-none">
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}

              </div>
            ))}
          </div>
        ) : (
          <Link
            href="/collections"
            className="flex flex-col items-center justify-center bg-white border border-dashed border-[rgba(0,0,0,0.12)] rounded-2xl py-10 hover:bg-[rgba(0,0,0,0.02)] active:opacity-70 transition-colors"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-3">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3v4M8 3v4"/>
            </svg>
            <div className="text-sm text-text-dim mb-1">No collections yet</div>
            <div className="text-sm font-medium text-text">Create your first collection</div>
          </Link>
        )}
        {/* Create collection shortcut */}
        <Link
          href="/collections"
          className="flex items-center justify-center gap-2 mt-2.5 py-2.5 text-sm font-medium text-text-muted hover:text-text active:opacity-70 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New collection
        </Link>
      </section>

      {/* ═══ TOP VALUABLE CARDS ═══ */}
      {topCards.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-3">Most valuable</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {topCards.map((card) => (
              <button key={card.code} onClick={() => setViewCard(card)} className="flex-none w-[90px] text-left active:opacity-80">
                <div className="aspect-[63/88] rounded-xl overflow-hidden bg-[#E4E4E7] mb-1.5">
                  {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="text-xs font-medium text-text truncate">{card.name}</div>
                <div className="font-mono text-xs text-[#059669]">{formatPrice(card.value)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══ RECENTLY ADDED ═══ */}
      {recentlyAdded.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-3">Recently added</h2>
          <div className="space-y-1.5">
            {recentlyAdded.map((card, i) => (
              <div key={card.code + i} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl px-3 py-2.5">
                {card.imageUrl && (
                  <div className="w-8 aspect-[63/88] rounded overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{card.name}</div>
                  <div className="text-xs text-text-dim font-mono">{card.code}</div>
                </div>
                {card.price > 0 && (
                  <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(card.price)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}


      {/* ═══ PRICE MOVERS ═══ */}
      {portfolio && (portfolio.winners.length > 0 || portfolio.losers.length > 0) && (
        <section>
          <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-4">Price movers</h2>
          <div className="grid grid-cols-2 gap-3">
            {portfolio.winners.length > 0 && (
              <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
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
              <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
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
              <div key={deal.id} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl px-4 py-3">
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
      {filteredIntel.length > 0 && (() => {
        // Strip HTML tags from summaries
        const clean = (s: string | null) => s?.replace(/<[^>]*>/g, "").trim() ?? null;
        const topArticles = filteredIntel.slice(0, 3);
        const gridArticles = filteredIntel.slice(3, 7);

        return (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text uppercase tracking-wide">Latest news</h2>
              <Link href="/intel" className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">See all</Link>
            </div>

            {/* Top 3 — full width with small thumbnail */}
            {topArticles.length > 0 && (
              <div className="space-y-2 mb-4">
                {topArticles.map((item) => (
                  <Link
                    key={item.id}
                    href="/intel"
                    className="flex items-start gap-3 bg-white rounded-2xl border border-[rgba(0,0,0,0.04)] px-4 py-3 hover:bg-[rgba(0,0,0,0.01)] active:opacity-80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {item.category && <div className="text-xs text-text-dim uppercase tracking-wider mb-0.5">{item.category}</div>}
                      <div className="text-sm font-semibold text-text line-clamp-2">{item.title}</div>
                      {item.summary && <div className="text-xs text-text-muted line-clamp-1 mt-0.5">{clean(item.summary)}</div>}
                    </div>
                    {item.imageUrl && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#E4E4E7] flex-none">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Grid — max 4 square articles */}
            {gridArticles.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {gridArticles.map((item) => (
                  <Link
                    key={item.id}
                    href="/intel"
                    className="block bg-white rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.01)] active:opacity-80 transition-colors"
                  >
                    {item.imageUrl && (
                      <div className="w-full bg-[#E4E4E7] overflow-hidden aspect-[16/9]">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                      </div>
                    )}
                    <div className="px-3 py-2.5">
                      {item.category && <div className="text-xs text-text-dim uppercase tracking-wider mb-0.5">{item.category}</div>}
                      <div className="text-xs font-semibold text-text line-clamp-2">{item.title}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* ═══ CARD DETAIL ═══ */}
      {viewCard && (
        <CardDataSheet
          cardCode={viewCard.code}
          cardName={viewCard.name}
          imageUrl={viewCard.imageUrl ?? ""}
          marketPrice={viewCard.value}
          onClose={() => setViewCard(null)}
        />
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
                className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70 transition-colors"
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
