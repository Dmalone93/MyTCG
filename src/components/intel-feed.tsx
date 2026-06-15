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
  { key: "tcg_japan", label: "Japan", icon: "🇯🇵" },
  { key: "tcg_english", label: "English", icon: "🌍" },
  { key: "sec_alt_arts", label: "SEC / Alt Arts", icon: "🎨" },
  { key: "prices", label: "Prices", icon: "💰" },
];

const PREVIEW_COUNT = 3;

export function IntelFeed({ items }: { items: IntelItem[] }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const grouped = new Map<string, IntelItem[]>();
  const myCardItems: IntelItem[] = [];

  for (const item of items) {
    if (item.mentionsUserCard) myCardItems.push(item);
    const cat = item.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

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

  // If a category is expanded, show full list
  if (expandedCategory) {
    const cat = CATEGORIES.find((c) => c.key === expandedCategory);
    const catItems = expandedCategory === "my_cards" ? myCardItems : (grouped.get(expandedCategory) ?? []);

    return (
      <div>
        <button
          onClick={() => setExpandedCategory(null)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text active:opacity-70 mb-4"
        >
          ← Back to Intel
        </button>
        <h2 className="font-bold text-lg text-text mb-4">
          {cat?.icon} {cat?.label ?? "Your Cards"}
          <span className="text-text-dim font-normal text-sm ml-2">{catItems.length} items</span>
        </h2>
        <div className="space-y-2">
          {catItems.map((item) => (
            <IntelCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <h2 className="font-bold text-base sm:text-lg text-text">Intel</h2>
        <div className="flex items-center gap-2">
          {refreshMsg && (
            <span className="text-xs text-text-muted hidden sm:inline">{refreshMsg}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs font-medium text-text-muted hover:text-text active:opacity-70 border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 sm:py-1.5 disabled:opacity-50 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* My Cards alert — full width at top */}
      {myCardItems.length > 0 && (
        <CategoryCard
          label="Your Cards in the News"
          icon="🔔"
          items={myCardItems}
          highlight
          onViewMore={() => setExpandedCategory("my_cards")}
        />
      )}

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeCategories.map((cat) => (
          <CategoryCard
            key={cat.key}
            label={cat.label}
            icon={cat.icon}
            items={grouped.get(cat.key) ?? []}
            onViewMore={() => setExpandedCategory(cat.key)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="py-16 text-center text-text-dim text-sm">
          No intel yet. Hit Refresh to scan.
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  label,
  icon,
  items,
  highlight = false,
  onViewMore,
}: {
  label: string;
  icon: string;
  items: IntelItem[];
  highlight?: boolean;
  onViewMore: () => void;
}) {
  const preview = items.slice(0, PREVIEW_COUNT);
  const hasMore = items.length > PREVIEW_COUNT;

  return (
    <div className={`border rounded-xl overflow-hidden ${
      highlight
        ? "border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.02)] col-span-full"
        : "border-[rgba(255,255,255,0.06)] bg-bg-elevated"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-semibold text-text flex-1">{label}</span>
        <span className="text-[10px] font-mono text-text-dim">{items.length}</span>
      </div>

      {/* Preview items */}
      {preview.map((item) => (
        <IntelCardCompact key={item.id} item={item} />
      ))}

      {/* View more */}
      {hasMore && (
        <button
          onClick={onViewMore}
          className="w-full text-center py-2.5 text-xs font-medium text-text-muted hover:text-text border-t border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] active:opacity-70 transition-colors"
        >
          View all {items.length} →
        </button>
      )}
    </div>
  );
}

/** Compact card for grid preview — minimal */
function IntelCardCompact({ item }: { item: IntelItem }) {
  const inner = (
    <div className="px-4 py-2.5 border-t border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
      <div className="flex items-start gap-1.5">
        {item.urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-none" />}
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-medium text-text leading-snug truncate">{item.title}</h4>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-dim">
            {item.source && <span>{item.source}</span>}
            {item.published && <span>· {formatDate(item.published)}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  if (item.sourceUrl) {
    return <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return inner;
}

/** Full card for expanded view */
function IntelCard({ item }: { item: IntelItem }) {
  const Wrapper = item.sourceUrl
    ? ({ children, className }: { children: React.ReactNode; className: string }) => (
        <a href={item.sourceUrl!} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
      )
    : ({ children, className }: { children: React.ReactNode; className: string }) => (
        <div className={className}>{children}</div>
      );

  return (
    <Wrapper className="block bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden hover:border-[rgba(255,255,255,0.1)] transition-colors">
      <div className="flex">
        {item.imageUrl && (
          <div className="flex-none w-[80px] min-h-[80px] relative bg-[#1C1C1F] hidden sm:block">
            <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="flex-1 min-w-0 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {item.urgent && <span className="text-[9px] font-mono uppercase text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded font-semibold">Urgent</span>}
            {item.jpOnly && <span className="text-[9px] font-mono uppercase text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">JP only</span>}
            {item.mentionsUserCard && <span className="text-[9px] font-mono uppercase text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.5 rounded font-semibold">Your card</span>}
          </div>
          <h3 className="font-medium text-sm text-text leading-snug mb-1">{item.title}</h3>
          {item.summary && <p className="text-xs text-text-muted leading-relaxed mb-2">{item.summary}</p>}
          {item.cardNames && item.cardNames.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {item.cardNames.map((name, i) => (
                <span key={i} className="text-[10px] font-mono text-text-muted bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded">{name}</span>
              ))}
            </div>
          )}
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
