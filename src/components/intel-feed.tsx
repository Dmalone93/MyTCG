"use client";

import { useState } from "react";

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

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const myCardItems = items.filter((i) => i.mentionsUserCard);

  // Lead story = most recent urgent, or most recent overall
  const lead = items.find((i) => i.urgent) ?? items[0] ?? null;
  const rest = items.filter((i) => i !== lead);

  // Get latest fetch time
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
      if (res.ok) setRefreshMsg(`${data.inserted ?? 0} new items`);
      else setRefreshMsg("Failed to scan");
    } catch { setRefreshMsg("Network error"); }
    setRefreshing(false);
  }

  return (
    <div>
      {/* Masthead */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold text-text tracking-tight">What&apos;s Happening</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-text-muted hover:text-text active:opacity-70 disabled:opacity-40 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-dim">
          {latestFetch && <span>Updated {latestFetch}</span>}
          {refreshMsg && <span>· {refreshMsg}</span>}
        </div>
        <div className="h-px bg-[rgba(255,255,255,0.08)] mt-4" />
      </div>

      {/* Your cards alert */}
      {myCardItems.length > 0 && (
        <div className="mb-6 border-l-2 border-[#34D399] pl-4">
          <div className="text-sm font-semibold text-[#34D399] mb-2">Your cards in the news</div>
          {myCardItems.slice(0, 3).map((item) => (
            <div key={item.id} className="mb-2 last:mb-0">
              <ArticleLink item={item}>
                <span className="text-sm text-text hover:underline">{item.title}</span>
              </ArticleLink>
            </div>
          ))}
        </div>
      )}

      {/* Lead story */}
      {lead && (
        <div className="mb-6">
          <ArticleLink item={lead}>
            <article className="group">
              {lead.imageUrl && (
                <div className="w-full aspect-[16/7] rounded-xl overflow-hidden bg-[#1C1C1F] mb-4">
                  <img
                    src={lead.imageUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-text-dim">{CAT_LABEL[lead.category ?? ""] ?? lead.category}</span>
                {lead.urgent && <span className="text-sm text-red-400 font-medium">Urgent</span>}
                <span className="text-sm text-text-dim">·</span>
                <span className="text-sm text-text-dim">{lead.published ? timeAgo(lead.published) : ""}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-text leading-tight mb-3 group-hover:underline decoration-1 underline-offset-4">
                {lead.title}
              </h2>
              {lead.summary && (
                <p className="text-base text-text-muted leading-relaxed mb-3">{lead.summary}</p>
              )}
              {lead.cardNames && lead.cardNames.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {lead.cardNames.map((name, i) => (
                    <span key={i} className="text-sm text-text-dim bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">{name}</span>
                  ))}
                </div>
              )}
              {lead.source && (
                <div className="text-sm text-text-dim">{lead.source}</div>
              )}
            </article>
          </ArticleLink>
          <div className="h-px bg-[rgba(255,255,255,0.06)] mt-6" />
        </div>
      )}

      {/* Rest of the feed */}
      {rest.length > 0 && (
        <div className="space-y-0">
          {rest.map((item) => (
            <ArticleRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-muted text-base mb-2">No stories yet</div>
          <div className="text-text-dim text-sm">Hit Refresh to scan for the latest news</div>
        </div>
      )}
    </div>
  );
}

function ArticleLink({ item, children }: { item: IntelItem; children: React.ReactNode }) {
  if (item.sourceUrl) {
    return (
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="block">
        {children}
      </a>
    );
  }
  return <div>{children}</div>;
}

function ArticleRow({ item }: { item: IntelItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[rgba(255,255,255,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-start gap-4 w-full text-left py-4 hover:bg-[rgba(255,255,255,0.01)] active:opacity-80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-text-dim">{CAT_LABEL[item.category ?? ""] ?? item.category}</span>
            {item.urgent && <span className="text-sm text-red-400 font-medium">Urgent</span>}
            <span className="text-sm text-text-dim ml-auto">{item.published ? timeAgo(item.published) : ""}</span>
          </div>
          <h3 className="text-base font-semibold text-text leading-snug">{item.title}</h3>
        </div>
        {item.imageUrl && !open && (
          <div className="w-[80px] h-[56px] rounded-lg overflow-hidden bg-[#1C1C1F] flex-none hidden sm:block">
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </button>

      {open && (
        <div className="pb-4 pr-4">
          {item.imageUrl && (
            <div className="w-full sm:w-[280px] aspect-[16/10] rounded-lg overflow-hidden bg-[#1C1C1F] mb-3 sm:float-right sm:ml-4">
              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {item.summary && (
            <p className="text-base text-text leading-relaxed mb-3">{item.summary}</p>
          )}
          {item.cardNames && item.cardNames.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {item.cardNames.map((name, i) => (
                <span key={i} className="text-sm text-text-dim bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">{name}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-text-dim clear-both">
            {item.source && <span>{item.source}</span>}
            {item.published && <span>{formatDate(item.published)}</span>}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text transition-colors ml-auto"
              >
                Read full article →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
