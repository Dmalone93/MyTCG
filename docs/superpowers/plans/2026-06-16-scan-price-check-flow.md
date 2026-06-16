# Scan → Price-Check Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the scan → disambiguate → result → compare flow so a user can scan a card, verify the match, input an asking price, and instantly see whether it's a good deal — with graded price comparison, mock listings, and stale/offline handling.

**Architecture:** The scan modal captures → posts to existing `/api/scan-card` → confidence ladder routes to result screen. A new `ScanResultScreen` component owns the hero "asking vs market" display, grade selector, mock listings, and price chart. A typed `ListingProvider` interface with `MockListingProvider` returns fake marketplace data. All pricing uses `useRegion()` + `formatPrice()`. Cached `card_prices` data is preferred over live API calls; a "refresh" button hits `/api/live-price` on demand.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing APIs (`/api/scan-card`, `/api/live-price`, `/api/price-history`, `/api/card-info`)

**Branch:** `feature/big-ui-overhaul`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/listings/types.ts` | `Listing` and `ListingProvider` interfaces |
| `src/lib/listings/mock-provider.ts` | `MockListingProvider` — realistic fake eBay/Cardmarket/TCGplayer data |
| `src/components/scan-result-screen.tsx` | Full result screen: asking vs market gap, listings, chart, grade selector |
| `src/components/grade-selector.tsx` | Raw / PSA / CGC / BGS grade picker |

### Modified files
| File | Changes |
|------|---------|
| `src/components/scan-modal.tsx` | Confidence ladder routing: HIGH → auto-result, AMBIGUOUS → candidate list, LOW → manual fallback. Replace post-scan card list with `ScanResultScreen`. Add "Not this card?" affordance. |

### Unchanged files (consumed, not modified)
| File | Used for |
|------|----------|
| `src/lib/charts/sparkline.tsx` | SVG sparkline in result screen |
| `src/lib/charts/price-chart.tsx` | Price chart (reference pattern — result screen has its own inline version) |
| `src/components/live-price-badge.tsx` | Pattern reference for live-price fetch |
| `src/components/region-selector.tsx` | `useRegion()` + `formatPrice()` |
| `src/app/api/live-price/route.ts` | On-demand JustTCG pricing |
| `src/app/api/price-history/route.ts` | Historical price data |
| `src/app/api/scan-card/route.ts` | Google Vision OCR (unchanged) |

---

## Task 1: Listing types and mock provider

**Files:**
- Create: `src/lib/listings/types.ts`
- Create: `src/lib/listings/mock-provider.ts`

- [ ] **Step 1: Create the typed interfaces**

```typescript
// src/lib/listings/types.ts
export interface Listing {
  source: "ebay" | "cardmarket" | "tcgplayer";
  price: number;
  currency: "GBP" | "EUR" | "USD";
  condition: string;
  shipping?: number;
  url: string;
  soldDate?: string | null;
}

export interface ListingProvider {
  getListings(cardCode: string, grade?: string): Promise<Listing[]>;
}
```

- [ ] **Step 2: Create the mock provider**

```typescript
// src/lib/listings/mock-provider.ts
import type { Listing, ListingProvider } from "./types";

export class MockListingProvider implements ListingProvider {
  async getListings(cardCode: string, grade?: string): Promise<Listing[]> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 200));

    const basePrice = this.hashPrice(cardCode);
    const isGraded = grade && grade !== "Raw";
    const multiplier = isGraded ? 1.8 + Math.random() * 1.2 : 1;

    return [
      {
        source: "ebay",
        price: +(basePrice * multiplier * (0.85 + Math.random() * 0.3)).toFixed(2),
        currency: "GBP",
        condition: isGraded ? `${grade}` : "Near Mint",
        shipping: +(1.5 + Math.random() * 2.5).toFixed(2),
        url: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`One Piece TCG ${cardCode}`)}`,
        soldDate: null,
      },
      {
        source: "ebay",
        price: +(basePrice * multiplier * (0.9 + Math.random() * 0.25)).toFixed(2),
        currency: "GBP",
        condition: isGraded ? `${grade}` : "Lightly Played",
        shipping: 0,
        url: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`One Piece TCG ${cardCode}`)}`,
        soldDate: null,
      },
      {
        source: "cardmarket",
        price: +(basePrice * multiplier * (0.88 + Math.random() * 0.2) * 1.17).toFixed(2),
        currency: "EUR",
        condition: isGraded ? `${grade}` : "Near Mint",
        shipping: +(2.0 + Math.random() * 3).toFixed(2),
        url: `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(cardCode)}`,
        soldDate: null,
      },
      {
        source: "tcgplayer",
        price: +(basePrice * multiplier * (0.92 + Math.random() * 0.18) * 1.27).toFixed(2),
        currency: "USD",
        condition: isGraded ? `${grade}` : "Near Mint",
        url: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(cardCode)}`,
        soldDate: null,
      },
    ];
  }

  /** Deterministic-ish base price from card code so same card returns similar prices */
  private hashPrice(code: string): number {
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
    return 2 + Math.abs(hash % 500) / 10; // Range: £2 – £52
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings/
git commit -m "feat: typed listing interfaces + mock provider"
```

---

## Task 2: Grade selector component

**Files:**
- Create: `src/components/grade-selector.tsx`

- [ ] **Step 1: Build the grade selector**

A horizontal pill-style selector: Raw | PSA | CGC | BGS. When PSA/CGC/BGS is selected, a secondary row appears with grade numbers (10, 9.5, 9, 8). Compact, single row on mobile.

```typescript
// src/components/grade-selector.tsx
"use client";

import { useState } from "react";

type Company = "Raw" | "PSA" | "CGC" | "BGS";

const GRADES: Record<Exclude<Company, "Raw">, string[]> = {
  PSA: ["10", "9", "8"],
  CGC: ["10", "9.5", "9"],
  BGS: ["10", "9.5", "9"],
};

export function GradeSelector({
  value,
  onChange,
}: {
  value: string; // "Raw" | "PSA 10" | "CGC 9.5" etc
  onChange: (grade: string) => void;
}) {
  const parts = value.split(" ");
  const company: Company = (["PSA", "CGC", "BGS"].includes(parts[0]) ? parts[0] : "Raw") as Company;
  const number = parts[1] ?? (company !== "Raw" ? "10" : "");

  function selectCompany(c: Company) {
    if (c === "Raw") {
      onChange("Raw");
    } else {
      onChange(`${c} ${GRADES[c][0]}`);
    }
  }

  function selectNumber(n: string) {
    if (company !== "Raw") onChange(`${company} ${n}`);
  }

  return (
    <div>
      {/* Company row */}
      <div className="flex gap-1.5 mb-2">
        {(["Raw", "PSA", "CGC", "BGS"] as Company[]).map((c) => (
          <button
            key={c}
            onClick={() => selectCompany(c)}
            className={`px-3 py-2 text-sm rounded-xl transition-colors ${
              company === c
                ? "bg-text text-bg font-medium"
                : "bg-bg-surface text-text-dim hover:text-text"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grade number row */}
      {company !== "Raw" && (
        <div className="flex gap-1.5">
          {GRADES[company].map((n) => (
            <button
              key={n}
              onClick={() => selectNumber(n)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                number === n
                  ? "bg-bg-surface font-medium text-text border border-text/20"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grade-selector.tsx
git commit -m "feat: grade selector component (Raw/PSA/CGC/BGS)"
```

---

## Task 3: Scan result screen

**Files:**
- Create: `src/components/scan-result-screen.tsx`

This is the hero component. It receives a matched `CatalogCard`, shows:
1. Verification thumbnail + card name + "Not this card?" link
2. Asking price input + delta vs market (hero number)
3. Mock marketplace listings
4. Price history sparkline with staleness marker
5. Graded vs raw selector that switches displayed prices

- [ ] **Step 1: Build the result screen**

```typescript
// src/components/scan-result-screen.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useRegion } from "@/components/region-selector";
import { GradeSelector } from "@/components/grade-selector";
import { Sparkline } from "@/lib/charts/sparkline";
import { MockListingProvider } from "@/lib/listings/mock-provider";
import type { Listing } from "@/lib/listings/types";

const listingProvider = new MockListingProvider();

const SOURCE_LABELS: Record<string, { label: string; available: boolean }> = {
  ebay: { label: "eBay", available: true },
  cardmarket: { label: "Cardmarket", available: false },
  tcgplayer: { label: "TCGPlayer", available: false },
};

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

type PriceData = {
  market: number | null;
  fetchedAt: string | null;
  gradedPrices: Record<string, Record<string, number>> | null;
};

type HistoryData = {
  points: { price: number; date: string }[];
  high: number;
  low: number;
  current: number;
  change: number;
};

export function ScanResultScreen({
  card,
  onRescan,
  onManualEntry,
  onClose,
}: {
  card: CatalogCard;
  onRescan: () => void;
  onManualEntry: () => void;
  onClose: () => void;
}) {
  const { formatPrice, config } = useRegion();

  // Asking price
  const [askingRaw, setAskingRaw] = useState("");
  const asking = parseFloat(askingRaw) || 0;

  // Grade
  const [grade, setGrade] = useState("Raw");

  // Pricing data (cached first, live on demand)
  const [priceData, setPriceData] = useState<PriceData>({ market: card.marketPrice, fetchedAt: null, gradedPrices: null });
  const [refreshing, setRefreshing] = useState(false);

  // Price history
  const [history, setHistory] = useState<HistoryData | null>(null);

  // Listings
  const [listings, setListings] = useState<Listing[]>([]);

  // Fetch cached price + history on mount
  useEffect(() => {
    // Price history
    fetch(`/api/price-history?code=${encodeURIComponent(card.cardSetId)}&range=30`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setHistory(d); })
      .catch(() => {});

    // Mock listings
    listingProvider.getListings(card.cardSetId, grade !== "Raw" ? grade : undefined)
      .then(setListings)
      .catch(() => {});
  }, [card.cardSetId, grade]);

  // Refresh live price on demand
  async function refreshPrice() {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ code: card.cardSetId });
      if (card.cardName) params.set("name", card.cardName);
      const res = await fetch(`/api/live-price?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.price) {
          setPriceData((prev) => ({
            ...prev,
            market: data.price,
            fetchedAt: new Date().toISOString(),
          }));
        }
      }
    } catch { /* offline — keep stale */ }
    setRefreshing(false);
  }

  // Current displayed price based on grade
  const displayPrice = useMemo(() => {
    if (grade === "Raw") return priceData.market;
    const gp = priceData.gradedPrices;
    if (!gp) return priceData.market;
    // Parse "PSA 10" → company "PSA", number "10"
    const [company, num] = grade.split(" ");
    return gp[company]?.[num] ?? priceData.market;
  }, [grade, priceData]);

  const marketConverted = displayPrice ? displayPrice * config.rate : null;
  const delta = marketConverted && asking > 0 ? asking - marketConverted : null;
  const deltaPercent = marketConverted && delta ? (delta / marketConverted) * 100 : null;
  const isGoodDeal = delta != null && delta < 0;
  const isBadDeal = delta != null && delta > 0;

  // Staleness
  const stalenessLabel = useMemo(() => {
    if (!priceData.fetchedAt) return "cached";
    const mins = Math.round((Date.now() - new Date(priceData.fetchedAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }, [priceData.fetchedAt]);

  return (
    <div className="space-y-5">
      {/* 1. Verification header */}
      <div className="flex gap-4 items-start">
        {card.imageUrl && (
          <img src={card.imageUrl} alt={card.cardName} className="w-[72px] rounded-lg aspect-[2.5/3.5] object-cover flex-none" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-text">{card.cardName}</div>
          <div className="font-mono text-sm text-text-dim mt-0.5">{card.cardSetId} · {card.rarity}</div>
          {card.cardColor && <div className="text-sm text-text-dim">{card.cardColor}</div>}
          <button
            onClick={onRescan}
            className="text-sm font-medium text-text-muted hover:text-text mt-2 active:opacity-70"
          >
            Not this card? Rescan
          </button>
        </div>
      </div>

      {/* 2. Asking vs market — the hero */}
      <div className="bg-bg-surface rounded-2xl p-4">
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Asking price</div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-text-dim text-lg">{config.symbol}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={askingRaw}
            onChange={(e) => setAskingRaw(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none font-mono text-2xl font-bold text-text placeholder:text-text-dim/30"
          />
        </div>

        {/* Market price row */}
        <div className="flex items-center justify-between py-2 border-t border-[rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-dim">Market</span>
            <span className="text-xs text-text-dim/60">{stalenessLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-text">
              {marketConverted != null ? formatPrice(displayPrice!) : "—"}
            </span>
            <button
              onClick={refreshPrice}
              disabled={refreshing}
              className="text-xs text-text-dim hover:text-text active:opacity-70 disabled:opacity-40"
            >
              {refreshing ? "..." : "↻"}
            </button>
          </div>
        </div>

        {/* Delta — the hero number */}
        {delta != null && (
          <div className={`flex items-center justify-between py-3 border-t border-[rgba(0,0,0,0.06)] ${isGoodDeal ? "bg-[rgba(5,150,105,0.04)]" : isBadDeal ? "bg-[rgba(220,38,38,0.04)]" : ""} -mx-4 px-4 rounded-b-2xl`}>
            <span className="text-sm font-medium text-text">
              {isGoodDeal ? "Below market" : isBadDeal ? "Above market" : "At market"}
            </span>
            <div className="text-right">
              <span className={`font-mono text-lg font-bold ${isGoodDeal ? "text-[#059669]" : isBadDeal ? "text-[#DC2626]" : "text-text"}`}>
                {delta >= 0 ? "+" : ""}{formatPrice(delta / config.rate)}
              </span>
              {deltaPercent != null && (
                <span className={`font-mono text-sm ml-2 ${isGoodDeal ? "text-[#059669]" : isBadDeal ? "text-[#DC2626]" : "text-text-dim"}`}>
                  ({deltaPercent >= 0 ? "+" : ""}{deltaPercent.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Live listings */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Cheapest listings</div>
        <div className="space-y-1.5">
          {listings
            .sort((a, b) => a.price - b.price)
            .map((listing, i) => {
              const info = SOURCE_LABELS[listing.source];
              const sym = CURRENCY_SYMBOLS[listing.currency] ?? listing.currency;
              return (
                <div key={i} className="flex items-center gap-3 bg-bg-surface rounded-xl px-3 py-2.5">
                  <span className="text-sm font-medium text-text w-[80px] flex-none">{info.label}</span>
                  <span className="text-sm text-text-dim flex-1">{listing.condition}</span>
                  <div className="text-right flex-none">
                    <span className="font-mono text-sm font-semibold text-text">
                      {sym}{listing.price.toFixed(2)}
                    </span>
                    {listing.shipping != null && listing.shipping > 0 && (
                      <span className="text-xs text-text-dim ml-1">+{sym}{listing.shipping.toFixed(2)}</span>
                    )}
                  </div>
                  {info.available ? (
                    <a href={listing.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-text-muted hover:text-text flex-none">
                      View →
                    </a>
                  ) : (
                    <span className="text-xs text-text-dim/50 flex-none">Soon</span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* 4. Recent market price chart */}
      {history && history.points.length >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim uppercase tracking-wider">Recent market price</span>
            <span className="text-xs text-text-dim">30d</span>
          </div>
          <div className="bg-bg-surface rounded-xl p-3">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-text">{formatPrice(history.current)}</span>
              <span className={`font-mono text-sm ${history.change >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {history.change >= 0 ? "+" : ""}{history.change.toFixed(1)}%
              </span>
              <div className="flex-1" />
              <span className="text-xs text-text-dim">H {formatPrice(history.high)}</span>
              <span className="text-xs text-text-dim">L {formatPrice(history.low)}</span>
            </div>
            <Sparkline data={history.points.map((p) => p.price)} height={60} />
          </div>
        </div>
      )}

      {/* 5. Graded vs Raw */}
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Graded vs Raw</div>
        <GradeSelector value={grade} onChange={setGrade} />
        {grade !== "Raw" && displayPrice && (
          <div className="mt-3 bg-bg-surface rounded-xl px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-text-dim">{grade} value</span>
            <span className="font-mono text-sm font-semibold text-text">{formatPrice(displayPrice)}</span>
          </div>
        )}
      </div>

      {/* Manual entry fallback */}
      <button
        onClick={onManualEntry}
        className="w-full text-sm font-medium text-text-muted hover:text-text py-2 active:opacity-70 text-center"
      >
        Enter code manually
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scan-result-screen.tsx
git commit -m "feat: scan result screen — asking vs market, listings, grade selector"
```

---

## Task 4: Rewire the scan modal with confidence ladder

**Files:**
- Modify: `src/components/scan-modal.tsx`

The existing scan modal already handles OCR + matching. Changes needed:
1. After match, show `ScanResultScreen` inline (replacing the old card list)
2. Confidence ladder: HIGH → auto-show result, AMBIGUOUS → candidate shortlist, LOW → manual entry
3. "Not this card?" affordance on result screen triggers rescan
4. Manual entry opens the card picker (reuse existing pattern)

- [ ] **Step 1: Update the scan modal**

Key changes to the existing scan-modal.tsx:

1. Import `ScanResultScreen` at the top
2. Add `resultCard` state — when set, show result screen instead of matched cards list
3. Confidence routing:
   - HIGH (confidence >= 90, single match): auto-set `resultCard` to first match
   - AMBIGUOUS (confidence >= 70, multiple matches): show candidate shortlist (existing UI but improved)
   - LOW (confidence < 70 after timeout): show "Enter code manually" prominently
4. Candidate shortlist: keep existing matched cards list but add verification thumbnails
5. Result screen callbacks: `onRescan` resets and restarts scanning, `onManualEntry` opens card picker

Changes to make in the return JSX:
- After matched cards section, add: `{resultCard && <ScanResultScreen ... />}`
- When `matchedCards.length === 1` and confidence >= 90, auto-set `resultCard`
- Add `showManualEntry` state for the LOW confidence fallback
- Replace hardcoded `€` with `formatPrice()` in matched cards list (line 551)
- Upgrade text-[10px] to text-xs and text-[13px] to text-sm (accessibility)

The full file is 589 lines. Rather than rewriting it entirely, modify these specific sections:

**Add imports (top of file):**
```typescript
import { ScanResultScreen } from "./scan-result-screen";
import { CardPicker } from "./card-picker";
import { useRegion } from "./region-selector";
```

**Add state (after existing state declarations ~line 92):**
```typescript
const [resultCard, setResultCard] = useState<CatalogCard | null>(null);
const [showManualEntry, setShowManualEntry] = useState(false);
const { formatPrice } = useRegion();
```

**Modify the HIGH confidence path (inside scanFrame, ~line 217-222):**
After `await lookupCard(code)` succeeds with single match, auto-set result:
```typescript
// In lookupCard, when cards.length === 1 and no variants:
if (cards.length === 1) {
  setMatchedCards(cards);
  setResultCard(cards[0]); // Auto-show result
}
```

**Replace matched cards JSX (~line 518-556) with:**
```tsx
{/* Result screen — shown when a card is locked in */}
{resultCard && !showManualEntry && (
  <div className="px-4 py-4 border-t border-[rgba(0,0,0,0.06)]">
    <ScanResultScreen
      card={resultCard}
      onRescan={() => {
        setResultCard(null);
        setMatchedCards([]);
        setConfidence(0);
        visionCallCount.current = 0;
        startScanning();
      }}
      onManualEntry={() => setShowManualEntry(true)}
      onClose={onClose}
    />
  </div>
)}

{/* Candidate shortlist — shown when AMBIGUOUS (multiple matches) */}
{!resultCard && matchedCards.length > 0 && (
  <div className="border-t border-[rgba(0,0,0,0.04)]">
    <div className="px-3 py-2 text-xs font-medium text-text-dim uppercase tracking-wider">
      {matchedCards.length === 1 ? "Match found" : "Pick your card"}
    </div>
    {matchedCards.map((card, i) => (
      <button
        key={card.cardSetId + i}
        onClick={() => setResultCard(card)}
        className="flex items-center gap-3 w-full text-left px-3 py-3 sm:py-2.5 border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
      >
        <div className="w-10 h-[56px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
          <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
          <span className="text-xs text-text-dim">{card.cardSetId} · {card.rarity} · {card.cardColor}</span>
        </span>
        {card.marketPrice != null && card.marketPrice > 0 && (
          <span className="font-mono text-sm font-semibold text-[#059669] flex-none">
            {formatPrice(card.marketPrice)}
          </span>
        )}
      </button>
    ))}
  </div>
)}
```

**Add manual entry fallback at bottom (before the upload/rescan buttons):**
```tsx
{/* Manual entry — card picker */}
{showManualEntry && (
  <CardPicker
    onPick={(card) => {
      setShowManualEntry(false);
      setResultCard(card);
    }}
    onPickMultiple={(cards) => {
      if (cards[0]) {
        setShowManualEntry(false);
        setResultCard(cards[0]);
      }
    }}
    onCancel={() => setShowManualEntry(false)}
  />
)}
```

- [ ] **Step 2: Test manually**

1. Open the app on mobile, tap the scan FAB
2. Point at a card with a clear code → should auto-lock and show result screen
3. Point at a card with multiple arts → should show candidate shortlist
4. Tap "Not this card?" → should rescan
5. Tap "Enter code manually" → should open card picker
6. Enter an asking price → delta should calculate vs market

- [ ] **Step 3: Commit**

```bash
git add src/components/scan-modal.tsx
git commit -m "feat: confidence ladder + scan result screen integration"
```

---

## Task 5: Polish and accessibility pass

**Files:**
- Modify: `src/components/scan-modal.tsx` — text size fixes
- Modify: `src/components/scan-result-screen.tsx` — verify 14px minimum

- [ ] **Step 1: Fix accessibility violations in scan modal**

In scan-modal.tsx, find and replace:
- `text-[10px]` → `text-xs` (min 12px for UI chrome, 14px for body)
- `text-[13px]` → `text-sm` (14px)
- Hardcoded `€` → `formatPrice()`

Specific lines:
- Line 520: `text-[10px]` label → `text-xs`
- Line 542: `text-[13px]` card name → `text-sm`
- Line 545: `text-[10px]` card meta → `text-xs`
- Line 551: `€{card.marketPrice.toFixed(2)}` → `formatPrice(card.marketPrice)`

- [ ] **Step 2: Verify scan result screen text sizes**

Check all text in scan-result-screen.tsx is at least `text-sm` (14px) for body text. Labels and chrome can be `text-xs` (12px) when uppercase/tracking-wider.

- [ ] **Step 3: Commit**

```bash
git add src/components/scan-modal.tsx src/components/scan-result-screen.tsx
git commit -m "fix: accessibility — 14px minimum text, region-aware prices in scan"
```

---

## Task 6: Final integration test and push

- [ ] **Step 1: Build check**

```bash
npx next build
```

Expected: Clean build, no type errors.

- [ ] **Step 2: Manual test checklist**

1. Scan with camera → HIGH confidence → result screen auto-shows
2. Scan ambiguous card → candidate shortlist → tap to select → result screen
3. Poor scan → manual entry button visible → card picker works
4. Result screen: type asking price → green/red delta calculates
5. Result screen: mock listings show with correct currency labels
6. Result screen: grade selector switches Raw/PSA/CGC/BGS
7. Result screen: "Not this card?" → rescan works
8. Result screen: "Enter code manually" → card picker → select → result
9. Price history chart renders (if data available)
10. Refresh price button works (calls /api/live-price)
11. All text ≥ 14px body

- [ ] **Step 3: Push branch**

```bash
git push -u origin feature/big-ui-overhaul
```
