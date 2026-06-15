"use client";

import { useState } from "react";

type IntelItem = {
  id: string;
  category: string | null;
  title: string | null;
  summary: string | null;
  source: string | null;
  published: string | null;
  urgent: boolean;
  jp_only: boolean;
  card_names: string[];
  fetched_at: string;
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

  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "my_cards") return item.mentionsUserCard;
    return item.category === filter;
  });

  const myCardCount = items.filter((i) => i.mentionsUserCard).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-bold text-lg text-text">Intel Feed</h2>
        <span className="text-xs text-text-dim font-mono">
          {items.length} items · refreshes every 6h
        </span>
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
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
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
  return (
    <div
      className={`bg-bg-elevated border rounded-xl p-4 transition-colors ${
        item.mentionsUserCard
          ? "border-accent/30 bg-accent/[0.03]"
          : "border-[rgba(255,255,255,0.05)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {item.category && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-text-dim bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
            )}
            {item.urgent && (
              <span className="text-[10px] font-mono tracking-[.08em] uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded font-semibold">
                Urgent
              </span>
            )}
            {item.jp_only && (
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
          {item.card_names && item.card_names.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {item.card_names.map((name, i) => (
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
          <div className="flex items-center gap-3 mt-3 text-xs text-text-dim">
            {item.source && (
              <span className="truncate max-w-[200px]">{item.source}</span>
            )}
            {item.published && <span>{item.published}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
