"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { ScanModal } from "./scan-modal";
import { addCard as addCardAction } from "@/app/actions/collections";
import type { CatalogCard } from "@/lib/catalog/types";

export function MobileNav() {
  const pathname = usePathname();
  const [showScan, setShowScan] = useState(false);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const collectionsCache = useRef<Array<{ id: string; name: string }> | null>(null);

  async function handleQuickAdd(card: CatalogCard) {
    try {
      // Fetch collections if not cached
      if (!collectionsCache.current) {
        const res = await fetch("/api/collections");
        if (res.ok) collectionsCache.current = await res.json();
      }
      const collections = collectionsCache.current;
      if (!collections || collections.length === 0) return;

      // Add to first collection
      await addCardAction({
        collectionId: collections[0].id,
        cardCode: card.cardSetId,
        cardName: card.cardName,
        quantity: 1,
        condition: "NM",
        isGraded: false,
        grade: null,
        gradedCompany: null,
        acquiredPrice: null,
        notes: null,
        imageUrl: card.imageUrl ?? null,
        marketPrice: card.marketPrice ?? null,
      });

      setAddedMsg(`Added ${card.cardName}`);
      setTimeout(() => setAddedMsg(null), 1500);
    } catch { /* */ }
  }

  const tabs = [
    {
      href: "/",
      label: "Home",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      href: "/search",
      label: "Search",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
    },
    null, // Scan button placeholder
    {
      href: "/intel",
      label: "News",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
    },
    {
      href: "/settings",
      label: "Profile",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 w-full z-50 bg-white border-t border-[rgba(0,0,0,0.06)]" style={{ paddingBottom: "env(safe-area-inset-bottom)", backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-around h-16 relative">
          {tabs.map((tab, i) => {
            if (!tab) {
              // Center scan button
              return (
                <button
                  key="scan"
                  onClick={() => setShowScan(true)}
                  className="flex flex-col items-center -mt-5"
                >
                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-text-muted mt-1">Scan</span>
                </button>
              );
            }

            const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${
                  isActive ? "text-accent" : "text-text-dim"
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Scan modal */}
      {showScan && (
        <ScanModal
          onResult={(card) => handleQuickAdd(card)}
          onClose={() => setShowScan(false)}
          quickMode
        />
      )}

      {/* Quick add toast */}
      {addedMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl px-4 py-3 shadow-lg text-sm text-text font-medium">
          {addedMsg}
        </div>
      )}
    </>
  );
}
