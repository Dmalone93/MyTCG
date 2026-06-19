"use client";

import Link from "next/link";
import { useState } from "react";
import { ScanModal } from "./scan-modal";
import { CardDataSheet } from "./card-data-sheet";
import type { CatalogCard } from "@/lib/catalog/types";

export function MobileSearchBar() {
  const [showScan, setShowScan] = useState(false);
  const [scannedCard, setScannedCard] = useState<CatalogCard | null>(null);

  return (
    <>
      <div className="sm:hidden flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 border border-[rgba(0,0,0,0.06)]">
        <Link href="/search" className="flex-1 flex items-center gap-2.5 active:scale-[0.98] transition-all">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 flex-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="text-text-dim text-sm">Search cards...</span>
        </Link>
        <button
          onClick={() => setShowScan(true)}
          className="flex-none p-0.5 rounded-lg text-text-dim hover:text-text active:opacity-70 transition-colors"
          title="Scan card"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </button>
      </div>

      {showScan && (
        <ScanModal
          onResult={(card) => {
            setShowScan(false);
            setScannedCard(card);
          }}
          onClose={() => setShowScan(false)}
        />
      )}

      {scannedCard && (
        <CardDataSheet
          cardCode={scannedCard.cardSetId}
          cardName={scannedCard.cardName}
          imageUrl={scannedCard.imageUrl}
          marketPrice={scannedCard.marketPrice}
          rarity={scannedCard.rarity}
          cardColor={scannedCard.cardColor}
          cardType={scannedCard.cardType}
          cardCost={scannedCard.cardCost}
          cardPower={scannedCard.cardPower}
          cardText={scannedCard.cardText}
          subTypes={scannedCard.subTypes}
          life={scannedCard.life}
          counterAmount={scannedCard.counterAmount}
          setName={scannedCard.setName}
          onClose={() => setScannedCard(null)}
        />
      )}
    </>
  );
}
