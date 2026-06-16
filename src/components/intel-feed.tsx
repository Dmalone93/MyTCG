"use client";

import { useState } from "react";
import { DealAlerts } from "./deal-alerts";
import { PreorderTracker } from "./preorder-tracker";

type IntelItem = {
  id: string;
  category: string | null;
  title: string | null;
  summary: string | null;
  source: string | null;
  sourceUrl: string | null;
  author: string | null;
  imageUrl: string | null;
  published: string | null;
  urgent: boolean | null;
  jpOnly: boolean | null;
  cardNames: string[] | null;
  fetchedAt: Date | null;
  mentionsUserCard: boolean;
};

function formatDate(d: string): string {
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function timeAgo(d: string): string {
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "";
  const diff = Date.now() - parsed.getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

const CAT_LABEL: Record<string, string> = {
  new_sets: "Releases", preorders_uk: "Pre-orders", top_cards: "Market",
  trending: "Trending", promos: "Promos", tournaments: "Events",
  deals: "Deals", tcg_japan: "Japan", tcg_english: "English",
  sec_alt_arts: "Alt Art", prices: "Market", anime_manga: "Anime",
};

function ArticleLink({ item, children, className }: { item: IntelItem; children: React.ReactNode; className?: string }) {
  if (item.sourceUrl) {
    return <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <div className={className}>{children}</div>;
}

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const myCardItems = items.filter((i) => i.mentionsUserCard);

  // Lead = most recent urgent or first item
  const lead = items.find((i) => i.urgent) ?? items[0] ?? null;
  // Secondary stories = next 2 after lead
  const secondary = items.filter((i) => i !== lead).slice(0, 2);
  // Rest
  const rest = items.filter((i) => i !== lead && !secondary.includes(i));

  // Group rest by category for columns
  const columns = new Map<string, IntelItem[]>();
  for (const item of rest) {
    const cat = item.category ?? "other";
    if (!columns.has(cat)) columns.set(cat, []);
    columns.get(cat)!.push(item);
  }

  const latestFetch = items[0]?.fetchedAt
    ? new Date(items[0].fetchedAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const res = await fetch("/api/scan-intel", { method: "POST" });
      const data = await res.json();
      if (res.ok) setRefreshMsg(`${data.inserted ?? 0} new`);
      else setRefreshMsg("Failed");
    } catch { setRefreshMsg("Error"); }
    setRefreshing(false);
  }

  return (
    <div>
      {/* Masthead */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-text tracking-tight">What&apos;s Happening</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-text-muted hover:text-text active:opacity-70 disabled:opacity-40 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
        </div>
        <div className="text-sm text-text-dim mt-1">
          {latestFetch && <span>Updated {latestFetch}</span>}
          {refreshMsg && <span> · {refreshMsg}</span>}
        </div>
        <div className="h-px bg-[rgba(0,0,0,0.1)] mt-3" />
      </div>

      <DealAlerts />
      <PreorderTracker />

      {/* Your cards banner */}
      {myCardItems.length > 0 && (
        <div className="mb-5 border-l-2 border-[#059669] pl-4 py-1">
          <div className="text-sm font-semibold text-[#059669] mb-1.5">Your cards in the news</div>
          {myCardItems.slice(0, 3).map((item) => (
            <ArticleLink key={item.id} item={item}>
              <span className="text-sm text-text hover:underline block mb-1">{item.title}</span>
            </ArticleLink>
          ))}
        </div>
      )}

      {/* Above the fold: Lead + Secondary */}
      {lead && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 mb-5">
          {/* Lead — takes 3 columns */}
          <div className="sm:col-span-3 sm:border-r sm:border-[rgba(0,0,0,0.06)] sm:pr-5">
            <ArticleLink item={lead} className="group block">
              {lead.imageUrl && (
                <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#E4E4E7] mb-3">
                  <img src={lead.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                </div>
              )}
              <div className="flex items-center gap-2 text-sm mb-1.5">
                <span className="text-text-dim">{CAT_LABEL[lead.category ?? ""] ?? lead.category}</span>
                {lead.urgent && <span className="text-red-500 font-semibold">Urgent</span>}
                {lead.published && <span className="font-semibold text-text">{timeAgo(lead.published)}</span>}
              </div>
              <h2 className="text-xl font-bold text-text leading-tight mb-2 group-hover:underline decoration-1 underline-offset-4">
                {lead.title}
              </h2>
              {lead.summary && (
                <p className="text-base text-text-muted leading-relaxed">{lead.summary}</p>
              )}
              {lead.source && (
                <div className="text-sm text-text-dim mt-2">{lead.source}</div>
              )}
            </ArticleLink>
          </div>

          {/* Secondary — takes 2 columns */}
          <div className="sm:col-span-2 space-y-4">
            {secondary.map((item, i) => (
              <div key={item.id}>
                <ArticleLink item={item} className="group block">
                  {item.imageUrl && (
                    <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#E4E4E7] mb-2">
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-text-dim">{CAT_LABEL[item.category ?? ""] ?? item.category}</span>
                    {item.urgent && <span className="text-red-500 font-semibold">Urgent</span>}
                    {item.published && <span className="font-semibold text-text">{timeAgo(item.published)}</span>}
                  </div>
                  <h3 className="text-base font-semibold text-text leading-snug mb-1 group-hover:underline decoration-1 underline-offset-4">
                    {item.title}
                  </h3>
                  {item.summary && (
                    <p className="text-sm text-text-muted leading-relaxed line-clamp-2">{item.summary}</p>
                  )}
                </ArticleLink>
                {i < secondary.length - 1 && (
                  <div className="h-px bg-[rgba(0,0,0,0.06)] mt-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {rest.length > 0 && (
        <div className="h-px bg-[rgba(0,0,0,0.08)] mb-5" />
      )}

      {/* Category columns */}
      {columns.size > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
          {[...columns.entries()].map(([cat, catItems]) => (
            <div key={cat}>
              {/* Column header */}
              <div className="text-sm font-bold text-text uppercase tracking-wide mb-2 pb-1.5 border-b border-text">
                {CAT_LABEL[cat] ?? cat}
              </div>
              {/* Column items */}
              <div className="space-y-3">
                {catItems.slice(0, 4).map((item) => (
                  <ArticleLink key={item.id} item={item} className="group block">
                    <h4 className="text-sm font-semibold text-text leading-snug mb-0.5 group-hover:underline decoration-1 underline-offset-2">
                      {item.title}
                    </h4>
                    {item.summary && (
                      <p className="text-sm text-text-muted leading-relaxed line-clamp-2">{item.summary}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm mt-1">
                      {item.published && <span className="font-semibold text-text">{timeAgo(item.published)}</span>}
                      {item.source && <span className="text-text-dim">{item.source}</span>}
                    </div>
                  </ArticleLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-muted text-base mb-2">No stories yet</div>
          <div className="text-text-dim text-sm">Hit Refresh to scan for the latest</div>
        </div>
      )}
    </div>
  );
}
