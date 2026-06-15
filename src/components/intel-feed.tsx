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

function timeAgo(d: string): string {
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  const diff = Date.now() - parsed.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CAT_LABEL: Record<string, string> = {
  new_sets: "Sets", preorders_uk: "Pre-order", top_cards: "Value",
  trending: "Trending", promos: "Promo", tournaments: "Event",
  deals: "Deal", tcg_japan: "Japan", tcg_english: "English",
  sec_alt_arts: "Alt Art", prices: "Price", anime_manga: "Anime",
};

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Split into action items and regular feed
  const actionItems = items.filter((i) => i.urgent || i.mentionsUserCard);
  const feedItems = items.filter((i) => !i.urgent && !i.mentionsUserCard);

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-bold text-base sm:text-lg text-text">Intel</h2>
        <span className="text-[10px] font-mono text-text-dim">{items.length} items</span>
        <div className="flex-1" />
        {refreshMsg && <span className="text-[10px] text-text-dim">{refreshMsg}</span>}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-text-dim hover:text-text active:opacity-70 disabled:opacity-40 transition-colors"
        >
          {refreshing ? "..." : "Refresh"}
        </button>
      </div>

      {/* Action needed — urgent + your cards */}
      {actionItems.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-mono uppercase text-text-dim tracking-wider mb-2">Action needed</div>
          <div className="space-y-1">
            {actionItems.map((item) => (
              <FeedRow key={item.id} item={item} isExpanded={expanded === item.id} onToggle={() => setExpanded(expanded === item.id ? null : item.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      {feedItems.length > 0 && (
        <div>
          {actionItems.length > 0 && (
            <div className="text-[10px] font-mono uppercase text-text-dim tracking-wider mb-2">Latest</div>
          )}
          <div className="space-y-1">
            {feedItems.map((item) => (
              <FeedRow key={item.id} item={item} isExpanded={expanded === item.id} onToggle={() => setExpanded(expanded === item.id ? null : item.id)} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center text-text-dim text-sm">
          No intel yet. Hit Refresh to scan.
        </div>
      )}
    </div>
  );
}

function FeedRow({ item, isExpanded, onToggle }: { item: IntelItem; isExpanded: boolean; onToggle: () => void }) {
  const isAction = item.urgent || item.mentionsUserCard;

  return (
    <div className={`rounded-lg transition-colors ${isExpanded ? "bg-bg-surface" : ""}`}>
      {/* Row */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg transition-colors active:opacity-80 ${
          isExpanded ? "" : "hover:bg-[rgba(255,255,255,0.02)]"
        }`}
      >
        {/* Urgency dot */}
        {isAction && (
          <span className={`w-1.5 h-1.5 rounded-full flex-none ${
            item.urgent ? "bg-red-400" : "bg-[#34D399]"
          }`} />
        )}

        {/* Category pill */}
        <span className="text-[10px] font-mono text-text-dim bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded flex-none w-[52px] text-center truncate">
          {CAT_LABEL[item.category ?? ""] ?? item.category}
        </span>

        {/* Title */}
        <span className={`flex-1 text-[13px] leading-snug min-w-0 ${isExpanded ? "text-text" : "text-text-muted"} truncate`}>
          {item.title}
        </span>

        {/* Time */}
        <span className="text-[10px] font-mono text-text-dim flex-none">
          {item.published ? timeAgo(item.published) : ""}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="ml-[68px] sm:ml-[72px]">
            {item.summary && (
              <p className="text-xs text-text-muted leading-relaxed mb-2">{item.summary}</p>
            )}

            {item.cardNames && item.cardNames.length > 0 && (
              <div className="flex gap-1 mb-2 flex-wrap">
                {item.cardNames.map((name, i) => (
                  <span key={i} className="text-[10px] font-mono text-text-dim bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded">{name}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-[11px] text-text-dim">
              {item.source && <span>{item.source}</span>}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-text transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
