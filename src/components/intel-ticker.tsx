"use client";

import Link from "next/link";

type TickerItem = {
  id: string;
  title: string | null;
  category: string | null;
  urgent: boolean | null;
  jpOnly: boolean | null;
  summary: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  tcg_japan: "JP",
  tcg_english: "EN",
  sec_alt_arts: "SEC",
  anime_manga: "ANIME",
  prices: "PRICE",
};

export function IntelTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-xl overflow-hidden">
      <div className="flex items-center">
        {/* Label */}
        <div className="flex-none px-2.5 sm:px-3 py-2.5 border-r border-[rgba(0,0,0,0.06)] bg-[#F4F4F5]">
          <Link
            href="/intel"
            className="font-mono text-[10px] tracking-[.1em] uppercase text-accent font-semibold hover:underline"
          >
            <span className="hidden sm:inline">INTEL</span>
            <span className="sm:hidden">!</span>
          </Link>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative">
          <div className="flex animate-ticker gap-8 px-4 py-2.5 whitespace-nowrap">
            {items.concat(items).map((item, i) => (
              <Link
                key={`${item.id}-${i}`}
                href="/intel"
                className="inline-flex items-center gap-2 text-sm hover:text-text transition-colors flex-none"
              >
                {item.urgent === true && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
                )}
                {item.category && (
                  <span className="font-mono text-[9px] tracking-[.06em] text-text-dim">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                )}
                <span className="text-text-muted">
                  {item.title}
                </span>
                {item.jpOnly === true && (
                  <span className="text-[9px] font-mono text-orange-400">
                    JP
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
