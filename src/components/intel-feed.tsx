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
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const CATEGORIES: Array<{ key: string; label: string; icon: string }> = [
  { key: "new_sets", label: "New Sets", icon: "📦" },
  { key: "preorders_uk", label: "Pre-orders UK", icon: "🇬🇧" },
  { key: "top_cards", label: "Top Cards", icon: "💎" },
  { key: "trending", label: "Trending", icon: "📈" },
  { key: "promos", label: "Promos", icon: "⭐" },
  { key: "tournaments", label: "Tournaments", icon: "🏆" },
  { key: "deals", label: "Deals", icon: "🏷" },
  // Legacy categories
  { key: "tcg_japan", label: "Japan", icon: "🇯🇵" },
  { key: "tcg_english", label: "English", icon: "🌍" },
  { key: "sec_alt_arts", label: "SEC / Alt Arts", icon: "🎨" },
  { key: "prices", label: "Prices", icon: "💰" },
];

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  // Group items by category
  const grouped = new Map<string, IntelItem[]>();
  const myCardItems: IntelItem[] = [];

  for (const item of items) {
    if (item.mentionsUserCard) myCardItems.push(item);
    const cat = item.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  // Only show categories that have items
  const activeCategories = CATEGORIES.filter((c) => grouped.has(c.key));

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
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <h2 className="font-bold text-base sm:text-lg text-text">Intel Feed</h2>
        <div className="flex items-center gap-2 sm:gap-3">
          {refreshMsg && (
            <span className="text-xs text-text-muted hidden sm:inline">{refreshMsg}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text active:opacity-70 border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 sm:py-1.5 disabled:opacity-50 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* My Cards alert */}
      {myCardItems.length > 0 && (
        <CategorySection
          label="Your Cards in the News"
          icon="🔔"
          items={myCardItems}
          highlight
        />
      )}

      {/* Category sections */}
      {activeCategories.map((cat) => (
        <CategorySection
          key={cat.key}
          label={cat.label}
          icon={cat.icon}
          items={grouped.get(cat.key) ?? []}
        />
      ))}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="py-16 text-center text-text-dim text-sm">
          No intel yet. Hit Refresh to scan for the latest.
        </div>
      )}
    </div>
  );
}

function CategorySection({
  label,
  icon,
  items,
  highlight = false,
}: {
  label: string;
  icon: string;
  items: IntelItem[];
  highlight?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className={`mb-4 border rounded-xl overflow-hidden ${
      highlight
        ? "border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.02)]"
        : "border-[rgba(255,255,255,0.06)] bg-bg-elevated"
    }`}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] active:opacity-80 transition-colors"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-semibold text-text flex-1">{label}</span>
        <span className="text-[10px] font-mono text-text-dim">{items.length}</span>
        <span className="text-text-dim text-xs ml-1">{collapsed ? "▸" : "▾"}</span>
      </button>

      {/* Items */}
      {!collapsed && (
        <div>
          {items.map((item) => (
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
      className="block border-t border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
    >
      <div className="flex">
        {item.imageUrl && (
          <div className="flex-none w-[80px] min-h-[80px] relative bg-[#1C1C1F] hidden sm:block">
            <img
              src={item.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 p-3 sm:p-4">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {item.urgent === true && (
              <span className="text-[9px] font-mono uppercase text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded font-semibold">
                Urgent
              </span>
            )}
            {item.jpOnly === true && (
              <span className="text-[9px] font-mono uppercase text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">
                JP only
              </span>
            )}
            {item.mentionsUserCard && (
              <span className="text-[9px] font-mono uppercase text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.5 rounded font-semibold">
                Your card
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-sm text-text leading-snug mb-1">
            {item.title}
          </h3>

          {/* Summary */}
          {item.summary && (
            <p className="text-xs text-text-muted leading-relaxed mb-2">
              {item.summary}
            </p>
          )}

          {/* Card names */}
          {item.cardNames && item.cardNames.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {item.cardNames.map((name, i) => (
                <span key={i} className="text-[10px] font-mono text-text-muted bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-text-dim flex-wrap">
            {item.source && <span className="font-medium text-text-muted">{item.source}</span>}
            {item.published && <span>{formatDate(item.published)}</span>}
            {item.sourceUrl && <span className="text-text-muted ml-auto">Read →</span>}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
