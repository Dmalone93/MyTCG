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

const CATEGORY_LABELS: Record<string, string> = {
  tcg_japan: "Japan",
  tcg_english: "English",
  sec_alt_arts: "SEC / Alt Arts",
  anime_manga: "Anime & Manga",
  prices: "Prices",
};

type FilterKey = "all" | "tcg_japan" | "tcg_english" | "sec_alt_arts" | "anime_manga" | "prices" | "my_cards";

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "my_cards") return item.mentionsUserCard;
    return item.category === filter;
  });

  const myCardCount = items.filter((i) => i.mentionsUserCard).length;

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const res = await fetch("/api/scan-intel", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setRefreshMsg(`Fetched ${data.inserted ?? 0} items — reload to see them`);
      } else {
        setRefreshMsg(data.error ?? "Failed");
      }
    } catch {
      setRefreshMsg("Network error");
    }
    setRefreshing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-5">
        <h2 className="font-bold text-base sm:text-lg text-text">Intel Feed</h2>
        <div className="flex items-center gap-2 sm:gap-3">
          {refreshMsg && (
            <span className="text-xs text-text-muted hidden sm:inline">{refreshMsg}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text active:opacity-70 bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 sm:py-1.5 disabled:opacity-50 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
          <span className="text-xs text-text-dim font-mono hidden sm:inline">
            {items.length} items
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {(
          [
            ["all", "All"],
            ["my_cards", `My Cards${myCardCount > 0 ? ` (${myCardCount})` : ""}`],
            ["tcg_japan", "Japan"],
            ["tcg_english", "English"],
            ["sec_alt_arts", "SEC / Alt Arts"],
            ["anime_manga", "Anime & Manga"],
            ["prices", "Prices"],
          ] as [FilterKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 sm:py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors active:opacity-70 ${
              filter === key
                ? "bg-bg-surface border-accent text-text"
                : "border-[rgba(255,255,255,0.06)] text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-text-dim text-sm">
          {filter === "my_cards"
            ? "No intel items mention your cards yet."
            : "No intel items found."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <IntelCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function IntelCard({ item }: { item: IntelItem }) {
  const Wrapper = item.sourceUrl
    ? ({ children, className }: { children: React.ReactNode; className: string }) => (
        <a href={item.sourceUrl!} target="_blank" rel="noopener noreferrer" className={className}>
          {children}
        </a>
      )
    : ({ children, className }: { children: React.ReactNode; className: string }) => (
        <div className={className}>{children}</div>
      );

  return (
    <Wrapper
      className={`block bg-bg-elevated border rounded-xl overflow-hidden transition-colors hover:border-[rgba(255,255,255,0.12)] ${
        item.mentionsUserCard
          ? "border-accent/30 bg-accent/[0.03]"
          : "border-[rgba(255,255,255,0.05)]"
      }`}
    >
      <div className="flex">
        {/* Thumbnail */}
        {item.imageUrl && (
          <div className="flex-none w-[120px] min-h-[100px] relative bg-[#1C1C1F] hidden sm:block">
            <img
              src={item.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 p-4">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {item.category && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-text-dim bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
            )}
            {item.urgent === true && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded font-semibold">
                Urgent
              </span>
            )}
            {item.jpOnly === true && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                JP only
              </span>
            )}
            {item.mentionsUserCard && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-accent bg-accent/10 px-2 py-0.5 rounded font-semibold">
                In your collection
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-sm text-text leading-snug mb-1">
            {item.title}
          </h3>

          {/* Summary */}
          {item.summary && (
            <p className="text-sm text-text-muted leading-relaxed">
              {item.summary}
            </p>
          )}

          {/* Card names */}
          {item.cardNames && item.cardNames.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {item.cardNames.map((name, i) => (
                <span
                  key={i}
                  className="text-[11px] font-mono text-text-muted bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 sm:gap-3 mt-3 text-xs text-text-dim flex-wrap">
            {item.source && (
              <span className="font-medium text-text-muted">{item.source}</span>
            )}
            {item.author && (
              <span>by {item.author}</span>
            )}
            {item.published && <span>{item.published}</span>}
            {item.sourceUrl && (
              <span className="text-accent ml-auto">Read →</span>
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
