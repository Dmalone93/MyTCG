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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CAT_LABEL: Record<string, string> = {
  new_sets: "Sets", preorders_uk: "Pre-order", top_cards: "Value",
  trending: "Trending", promos: "Promo", tournaments: "Event",
  deals: "Deal", tcg_japan: "Japan", tcg_english: "English",
  sec_alt_arts: "Alt Art", prices: "Price", anime_manga: "Anime",
};

/** Extract key facts from items — dates, prices, locations */
function extractHighlights(items: IntelItem[]): string[] {
  const highlights: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.summary) continue;
    const text = item.summary;

    // Extract dates like "June 2026", "July 25, 2026", "Q3 2026"
    const dateMatches = text.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?|\b(?:Q[1-4]\s+\d{4})\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}/gi
    );

    // Extract prices like "€89.99", "£45", "$120"
    const priceMatches = text.match(/[€£$]\d+(?:\.\d{2})?/g);

    // Extract card codes
    const codeMatches = text.match(/(?:OP|ST|EB|PRB)-?\d{1,2}-?\d{2,3}/gi);

    // Build highlight from title + key facts
    const facts: string[] = [];
    if (dateMatches) facts.push(...dateMatches.slice(0, 1));
    if (priceMatches) facts.push(...priceMatches.slice(0, 1));
    if (codeMatches) facts.push(...codeMatches.slice(0, 1));

    if (facts.length > 0 && item.title) {
      const h = `${item.title} — ${facts.join(" · ")}`;
      if (!seen.has(item.title)) {
        highlights.push(h);
        seen.add(item.title);
      }
    }
  }

  return highlights.slice(0, 5);
}

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const actionItems = items.filter((i) => i.urgent || i.mentionsUserCard);
  const feedItems = items.filter((i) => !i.urgent && !i.mentionsUserCard);
  const highlights = extractHighlights(items);

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
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-bold text-lg text-text">Intel</h2>
        <div className="flex-1" />
        {refreshMsg && <span className="text-sm text-text-dim">{refreshMsg}</span>}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-sm text-text-muted hover:text-text active:opacity-70 disabled:opacity-40 transition-colors"
        >
          {refreshing ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* Highlights banner */}
      {highlights.length > 0 && (
        <div className="mb-6 border border-[rgba(255,255,255,0.08)] rounded-xl p-4 bg-[rgba(255,255,255,0.02)]">
          <div className="text-sm font-semibold text-text mb-3">Key highlights</div>
          <div className="space-y-2.5">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] mt-2 flex-none" />
                <span className="text-sm text-text leading-relaxed">{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action needed */}
      {actionItems.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-text mb-3">Action needed</div>
          <div className="space-y-1">
            {actionItems.map((item) => (
              <FeedRow
                key={item.id}
                item={item}
                isExpanded={expanded === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      {feedItems.length > 0 && (
        <div>
          {actionItems.length > 0 && (
            <div className="text-sm font-semibold text-text mb-3">Latest</div>
          )}
          <div className="space-y-1">
            {feedItems.map((item) => (
              <FeedRow
                key={item.id}
                item={item}
                isExpanded={expanded === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center text-text-muted text-sm">
          No intel yet. Hit Refresh to scan.
        </div>
      )}
    </div>
  );
}

function FeedRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: IntelItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isAction = item.urgent || item.mentionsUserCard;

  return (
    <div className={`rounded-lg transition-colors ${isExpanded ? "bg-bg-surface" : ""}`}>
      {/* Row */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-lg transition-colors active:opacity-80 ${
          isExpanded ? "" : "hover:bg-[rgba(255,255,255,0.02)]"
        }`}
      >
        {/* Urgency dot */}
        {isAction && (
          <span className={`w-2 h-2 rounded-full flex-none ${
            item.urgent ? "bg-red-400" : "bg-[#34D399]"
          }`} />
        )}

        {/* Category */}
        <span className="text-sm text-text-dim bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded flex-none">
          {CAT_LABEL[item.category ?? ""] ?? item.category}
        </span>

        {/* Title */}
        <span className={`flex-1 text-sm leading-relaxed min-w-0 ${
          isExpanded ? "text-text" : "text-text-muted"
        }`}>
          {item.title}
        </span>

        {/* Time */}
        <span className="text-sm text-text-dim flex-none">
          {item.published ? timeAgo(item.published) : ""}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-4">
          <div className="pl-3 sm:pl-[72px] border-l-2 border-[rgba(255,255,255,0.06)] sm:border-0 ml-3 sm:ml-0">
            {item.summary && (
              <p className="text-sm text-text leading-relaxed mb-3">{item.summary}</p>
            )}

            {item.cardNames && item.cardNames.length > 0 && (
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {item.cardNames.map((name, i) => (
                  <span
                    key={i}
                    className="text-sm text-text-muted bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-sm text-text-dim">
              {item.source && <span>{item.source}</span>}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-text transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open link →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
