# Collector's Bloomberg Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add price history charts, grading ROI calculator, portfolio dashboard, deal alerts, and pre-order tracker to MyTCG — turning it from a collection tracker into an investor-grade tool.

**Architecture:** Three new DB tables (`card_price_history`, `deal_alerts`, `preorder_items`) store time-series data populated by enhanced daily crons. New API routes serve chart data and deals. New client components render SVG charts and dashboard sections. All existing features remain untouched.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, Tailwind CSS, SVG for charts (no charting library).

---

## File Structure

### New files
- `src/lib/db/schema.ts` — modify: add 3 new tables
- `src/lib/charts/sparkline.tsx` — SVG sparkline component
- `src/lib/charts/price-chart.tsx` — full interactive price chart component
- `src/components/grading-roi.tsx` — grading ROI calculator component
- `src/components/portfolio-dashboard.tsx` — portfolio value chart + movers + grading opps
- `src/components/deal-alerts.tsx` — deal alerts section
- `src/components/preorder-tracker.tsx` — pre-order price comparison section
- `src/app/api/price-history/route.ts` — GET price history for a card
- `src/app/api/portfolio/route.ts` — GET portfolio value over time
- `src/app/api/deals/route.ts` — GET current deal alerts

### Modified files
- `src/app/api/refresh-prices/route.ts` — add price history recording + deal detection
- `src/app/api/scan-intel/route.ts` — add pre-order parsing
- `src/app/(app)/page.tsx` — add portfolio dashboard section
- `src/components/card-detail-modal.tsx` — add price chart + grading ROI
- `src/components/card-data-sheet.tsx` — add price chart + grading ROI
- `src/components/intel-feed.tsx` — add deals + pre-orders sections above news
- `supabase/migrations/001_initial_schema.sql` — add 3 new tables

---

### Task 1: Add price history table to schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Add card_price_history table to Drizzle schema**

Add to `src/lib/db/schema.ts` after the `cardPrices` table:

```typescript
export const cardPriceHistory = pgTable("card_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardCode: text("card_code").notNull(),
  price: numeric("price").notNull(),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.cardCode, table.recordedAt),
  index("idx_price_history_code_date").on(table.cardCode, table.recordedAt),
]);
```

- [ ] **Step 2: Add deal_alerts table to Drizzle schema**

```typescript
export const dealAlerts = pgTable("deal_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardCode: text("card_code").notNull().unique(),
  cardName: text("card_name").notNull(),
  currentPrice: numeric("current_price").notNull(),
  avgPrice: numeric("avg_price").notNull(),
  discountPct: numeric("discount_pct").notNull(),
  imageUrl: text("image_url"),
  detectedAt: timestamp("detected_at", { mode: "date" }).defaultNow(),
});
```

- [ ] **Step 3: Add preorder_items table to Drizzle schema**

```typescript
export const preorderItems = pgTable("preorder_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  productName: text("product_name").notNull(),
  setCode: text("set_code"),
  releaseDate: timestamp("release_date", { mode: "date" }),
  retailer: text("retailer").notNull(),
  price: numeric("price").notNull(),
  currency: text("currency").default("GBP"),
  url: text("url").notNull(),
  inStock: boolean("in_stock").default(true),
  fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow(),
}, (table) => [
  unique().on(table.productName, table.retailer),
]);
```

- [ ] **Step 4: Update SQL migration**

Add to `supabase/migrations/001_initial_schema.sql` before the indexes section:

```sql
CREATE TABLE IF NOT EXISTS card_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code TEXT NOT NULL,
  price NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_code, recorded_at)
);

CREATE TABLE IF NOT EXISTS deal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code TEXT NOT NULL UNIQUE,
  card_name TEXT NOT NULL,
  current_price NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  discount_pct NUMERIC NOT NULL,
  image_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preorder_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  set_code TEXT,
  release_date TIMESTAMPTZ,
  retailer TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'GBP',
  url TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_name, retailer)
);

CREATE INDEX IF NOT EXISTS idx_price_history_code_date ON card_price_history(card_code, recorded_at DESC);
```

- [ ] **Step 5: Push schema to database**

Run: `DATABASE_URL="postgresql://neondb_owner:npg_Xrw4Yp9fKsLI@ep-solitary-credit-ab60x2a0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" npx drizzle-kit push`

Expected: `[✓] Changes applied`

- [ ] **Step 6: Verify build**

Run: `npx next build`

Expected: Build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/001_initial_schema.sql
git commit -m "feat: add price_history, deal_alerts, preorder_items tables"
```

---

### Task 2: Record price history in daily cron

**Files:**
- Modify: `src/app/api/refresh-prices/route.ts`

- [ ] **Step 1: Import the new table**

Add to imports at top of `src/app/api/refresh-prices/route.ts`:

```typescript
import { cardPriceHistory, dealAlerts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
```

- [ ] **Step 2: Add price history recording after the price update loop**

After the existing `for (const code of codes)` loop that updates `cardPrices`, add:

```typescript
// Record price history
const today = new Date();
today.setHours(0, 0, 0, 0);

for (const code of codes) {
  const catalogCard = priceMap.get(code);
  if (!catalogCard || catalogCard.marketPrice == null) continue;

  await db
    .insert(cardPriceHistory)
    .values({
      cardCode: code,
      price: String(catalogCard.marketPrice),
      recordedAt: today,
    })
    .onConflictDoNothing();
}
```

(The `priceMap` variable already exists in the file — it maps card codes to catalog entries.)

- [ ] **Step 3: Add deal detection after price history recording**

```typescript
// Detect deals — cards 20%+ below 30-day average
const allCardsWithHistory = await db
  .select({
    cardCode: cardPriceHistory.cardCode,
    avgPrice: sql<number>`AVG(${cardPriceHistory.price}::numeric)`,
  })
  .from(cardPriceHistory)
  .where(sql`${cardPriceHistory.recordedAt} > NOW() - INTERVAL '30 days'`)
  .groupBy(cardPriceHistory.cardCode)
  .having(sql`COUNT(*) >= 7`);

// Clear old deals
await db.delete(dealAlerts);

let dealsInserted = 0;
for (const row of allCardsWithHistory) {
  const catalog = await fetchCatalog();
  const card = catalog.find((c) => c.cardSetId === row.cardCode);
  if (!card || card.marketPrice == null) continue;

  const avg = Number(row.avgPrice);
  const current = card.marketPrice;
  if (avg <= 0) continue;

  const discountPct = ((avg - current) / avg) * 100;
  if (discountPct >= 20) {
    await db
      .insert(dealAlerts)
      .values({
        cardCode: row.cardCode,
        cardName: card.cardName,
        currentPrice: String(current),
        avgPrice: String(avg),
        discountPct: String(Math.round(discountPct)),
        imageUrl: card.imageUrl ?? null,
      })
      .onConflictDoNothing();
    dealsInserted++;
    if (dealsInserted >= 50) break;
  }
}
```

- [ ] **Step 4: Update the return JSON to include new counts**

Change the return statement to:

```typescript
return NextResponse.json({
  message: `Updated ${updated} prices, recorded history, found ${dealsInserted} deals`,
  updated,
  total: codes.length,
  deals: dealsInserted,
});
```

- [ ] **Step 5: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/refresh-prices/route.ts
git commit -m "feat: record price history and detect deals in daily cron"
```

---

### Task 3: Price history API

**Files:**
- Create: `src/app/api/price-history/route.ts`

- [ ] **Step 1: Create the price history endpoint**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardPriceHistory } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";
  const range = searchParams.get("range") ?? "30"; // days

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const days = Math.min(parseInt(range) || 30, 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await db
    .select({
      price: cardPriceHistory.price,
      date: cardPriceHistory.recordedAt,
    })
    .from(cardPriceHistory)
    .where(
      and(
        eq(cardPriceHistory.cardCode, code.toUpperCase()),
        gte(cardPriceHistory.recordedAt, since)
      )
    )
    .orderBy(cardPriceHistory.recordedAt);

  const points = history.map((h) => ({
    price: Number(h.price),
    date: h.date.toISOString().split("T")[0],
  }));

  const prices = points.map((p) => p.price);
  const high = prices.length > 0 ? Math.max(...prices) : 0;
  const low = prices.length > 0 ? Math.min(...prices) : 0;
  const current = prices.length > 0 ? prices[prices.length - 1] : 0;
  const first = prices.length > 0 ? prices[0] : 0;
  const change = first > 0 ? ((current - first) / first) * 100 : 0;

  return NextResponse.json({
    points,
    high,
    low,
    current,
    change: Math.round(change * 10) / 10,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds, new route `/api/price-history` appears.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/price-history/route.ts
git commit -m "feat: add /api/price-history endpoint"
```

---

### Task 4: SVG Sparkline component

**Files:**
- Create: `src/lib/charts/sparkline.tsx`

- [ ] **Step 1: Create the sparkline component**

```typescript
"use client";

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "#059669",
  negativeColor = "#DC2626",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  negativeColor?: string;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="bg-bg-surface rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? color : negativeColor;

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/charts/sparkline.tsx
git commit -m "feat: add SVG sparkline component"
```

---

### Task 5: Full interactive price chart component

**Files:**
- Create: `src/lib/charts/price-chart.tsx`

- [ ] **Step 1: Create the price chart component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "./sparkline";

type PricePoint = { price: number; date: string };
type Range = "7" | "30" | "90" | "365";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}

export function PriceChart({ cardCode }: { cardCode: string }) {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<{
    points: PricePoint[];
    high: number;
    low: number;
    current: number;
    change: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/price-history?code=${encodeURIComponent(cardCode)}&range=${range}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardCode, range]);

  if (loading) {
    return <div className="h-[120px] bg-bg-surface rounded-lg animate-pulse" />;
  }

  if (!data || data.points.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center text-sm text-text-dim bg-bg-surface rounded-lg">
        Not enough price data yet
      </div>
    );
  }

  const prices = data.points.map((p) => p.price);
  const isUp = data.change >= 0;

  return (
    <div className="bg-bg-surface rounded-lg p-4">
      {/* Stats row */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-lg font-semibold text-text">{fmt(data.current)}</span>
        <span className={`font-mono text-sm font-semibold ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {isUp ? "+" : ""}{data.change}%
        </span>
        <div className="flex-1" />
        <span className="text-sm text-text-dim">H {fmt(data.high)}</span>
        <span className="text-sm text-text-dim">L {fmt(data.low)}</span>
      </div>

      {/* Chart */}
      <Sparkline data={prices} width={500} height={80} />

      {/* Range toggles */}
      <div className="flex gap-1 mt-3">
        {(["7", "30", "90", "365"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 text-sm rounded transition-colors ${
              range === r
                ? "bg-text text-bg font-semibold"
                : "text-text-dim hover:text-text"
            }`}
          >
            {r === "365" ? "All" : `${r}d`}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/charts/price-chart.tsx
git commit -m "feat: add interactive price chart with range toggles"
```

---

### Task 6: Grading ROI calculator component

**Files:**
- Create: `src/components/grading-roi.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}

type GradedPrices = Record<string, number>;

const GRADE_ORDER = ["PSA 10", "PSA 9", "PSA 8", "BGS 10", "BGS 9.5", "CGC 10", "CGC 9.5"];

export function GradingROI({
  rawPrice,
  gradedPrices,
}: {
  rawPrice: number;
  gradedPrices: GradedPrices;
}) {
  const [gradingCost, setGradingCost] = useState(20);

  const grades = GRADE_ORDER.filter((g) => g in gradedPrices && gradedPrices[g] > 0);

  if (grades.length === 0 || rawPrice <= 0) return null;

  const rows = grades.map((grade) => {
    const graded = gradedPrices[grade];
    const profit = graded - rawPrice - gradingCost;
    const roi = ((profit) / (rawPrice + gradingCost)) * 100;
    return { grade, graded, profit, roi };
  });

  const best = rows.reduce((a, b) => (b.roi > a.roi ? b : a), rows[0]);

  return (
    <div className="bg-bg-surface rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-text">Grading ROI</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-dim">Cost</label>
          <input
            type="number"
            value={gradingCost}
            onChange={(e) => setGradingCost(parseInt(e.target.value) || 0)}
            className="w-16 bg-bg-elevated border border-[rgba(0,0,0,0.08)] rounded px-2 py-1 text-sm text-text text-right"
          />
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.grade}
            className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${
              row.grade === best.grade ? "bg-[rgba(5,150,105,0.06)]" : ""
            }`}
          >
            <span className="w-[70px] text-text-muted flex-none">{row.grade}</span>
            <span className="font-mono text-text flex-none w-[70px] text-right">{fmt(row.graded)}</span>
            <span className={`font-mono flex-none w-[70px] text-right font-semibold ${
              row.profit >= 0 ? "text-[#059669]" : "text-[#DC2626]"
            }`}>
              {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
            </span>
            <span className={`font-mono flex-1 text-right font-semibold ${
              row.roi >= 0 ? "text-[#059669]" : "text-[#DC2626]"
            }`}>
              {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(0)}%
            </span>
            {row.grade === best.grade && (
              <span className="text-[10px] font-semibold text-[#059669] bg-[rgba(5,150,105,0.1)] px-1.5 py-0.5 rounded flex-none">
                Best
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/grading-roi.tsx
git commit -m "feat: add grading ROI calculator component"
```

---

### Task 7: Add price chart + grading ROI to card detail views

**Files:**
- Modify: `src/components/card-detail-modal.tsx`
- Modify: `src/components/card-data-sheet.tsx`

- [ ] **Step 1: Add imports to card-detail-modal.tsx**

Add at the top of `src/components/card-detail-modal.tsx`:

```typescript
import { PriceChart } from "@/lib/charts/price-chart";
import { GradingROI } from "@/components/grading-roi";
```

- [ ] **Step 2: Insert price chart and grading ROI into the card detail modal**

In `card-detail-modal.tsx`, find the comment `{/* Graded prices */}` and add BEFORE it:

```typescript
            {/* Price chart */}
            <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
              <PriceChart cardCode={card.cardCode} />
            </div>

            {/* Grading ROI */}
            {sortedGrades.length > 0 && market > 0 && (
              <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
                <GradingROI rawPrice={market} gradedPrices={gradedPrices} />
              </div>
            )}
```

- [ ] **Step 3: Add imports to card-data-sheet.tsx**

Add at the top of `src/components/card-data-sheet.tsx`:

```typescript
import { PriceChart } from "@/lib/charts/price-chart";
```

- [ ] **Step 4: Insert price chart into card data sheet**

In `card-data-sheet.tsx`, find the `{/* Synergies */}` comment and add BEFORE it:

```typescript
        {/* Price chart */}
        <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
          <PriceChart cardCode={cardCode} />
        </div>
```

- [ ] **Step 5: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/card-detail-modal.tsx src/components/card-data-sheet.tsx
git commit -m "feat: add price chart and grading ROI to card detail views"
```

---

### Task 8: Portfolio API

**Files:**
- Create: `src/app/api/portfolio/route.ts`

- [ ] **Step 1: Create the portfolio endpoint**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { collectionCards, cardPriceHistory, cardPrices } from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = Math.min(parseInt(searchParams.get("range") ?? "30") || 30, 365);

  // Get user's cards with quantities
  const userCards = await db
    .select({
      cardCode: collectionCards.cardCode,
      quantity: collectionCards.quantity,
    })
    .from(collectionCards)
    .where(eq(collectionCards.userId, userId));

  if (userCards.length === 0) {
    return NextResponse.json({ points: [], movers: [], gradingOpps: [] });
  }

  const cardMap = new Map<string, number>();
  for (const c of userCards) {
    const qty = c.quantity ?? 1;
    cardMap.set(c.cardCode, (cardMap.get(c.cardCode) ?? 0) + qty);
  }

  const codes = [...cardMap.keys()];
  const since = new Date();
  since.setDate(since.getDate() - range);

  // Get price history for user's cards
  const history = await db
    .select({
      cardCode: cardPriceHistory.cardCode,
      price: cardPriceHistory.price,
      date: cardPriceHistory.recordedAt,
    })
    .from(cardPriceHistory)
    .where(
      and(
        sql`${cardPriceHistory.cardCode} = ANY(${codes})`,
        gte(cardPriceHistory.recordedAt, since)
      )
    )
    .orderBy(cardPriceHistory.recordedAt);

  // Group by date, sum portfolio value
  const dateMap = new Map<string, number>();
  for (const row of history) {
    const dateStr = row.date.toISOString().split("T")[0];
    const qty = cardMap.get(row.cardCode) ?? 1;
    const value = Number(row.price) * qty;
    dateMap.set(dateStr, (dateMap.get(dateStr) ?? 0) + value);
  }

  const points = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  // Top movers — compare current price to 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const currentPrices = await db
    .select()
    .from(cardPrices)
    .where(sql`${cardPrices.cardCode} = ANY(${codes})`);

  const oldPrices = await db
    .select({
      cardCode: cardPriceHistory.cardCode,
      price: cardPriceHistory.price,
    })
    .from(cardPriceHistory)
    .where(
      and(
        sql`${cardPriceHistory.cardCode} = ANY(${codes})`,
        sql`${cardPriceHistory.recordedAt}::date = ${sevenDaysAgo.toISOString().split("T")[0]}::date`
      )
    );

  const oldMap = new Map(oldPrices.map((p) => [p.cardCode, Number(p.price)]));

  const movers = currentPrices
    .map((p) => {
      const current = Number(p.rawMarket ?? 0);
      const old = oldMap.get(p.cardCode);
      if (!old || old === 0 || current === 0) return null;
      const change = ((current - old) / old) * 100;
      return { cardCode: p.cardCode, current, old, change: Math.round(change * 10) / 10 };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null && Math.abs(m.change) > 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const winners = movers.filter((m) => m.change > 0).slice(0, 3);
  const losers = movers.filter((m) => m.change < 0).slice(0, 3);

  // Grading opportunities
  const gradingOpps = currentPrices
    .map((p) => {
      const raw = Number(p.rawMarket ?? 0);
      if (raw <= 0) return null;
      const graded = p.gradedPrices as Record<string, number> | null;
      if (!graded) return null;
      const bestGrade = Object.entries(graded).reduce(
        (best, [grade, price]) => (price > best.price ? { grade, price } : best),
        { grade: "", price: 0 }
      );
      if (bestGrade.price <= raw) return null;
      const roi = ((bestGrade.price - raw - 20) / (raw + 20)) * 100;
      return { cardCode: p.cardCode, raw, gradedPrice: bestGrade.price, grade: bestGrade.grade, roi: Math.round(roi) };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.roi >= 100)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  return NextResponse.json({ points, winners, losers, gradingOpps }, {
    headers: { "Cache-Control": "private, s-maxage=300" },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portfolio/route.ts
git commit -m "feat: add /api/portfolio endpoint with movers and grading opps"
```

---

### Task 9: Portfolio dashboard component

**Files:**
- Create: `src/components/portfolio-dashboard.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "@/lib/charts/sparkline";

type PortfolioData = {
  points: Array<{ date: string; value: number }>;
  winners: Array<{ cardCode: string; current: number; change: number }>;
  losers: Array<{ cardCode: string; current: number; change: number }>;
  gradingOpps: Array<{ cardCode: string; raw: number; gradedPrice: number; grade: string; roi: number }>;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetched(true);
    fetch("/api/portfolio?range=30")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!fetched || loading) return null;
  if (!data || data.points.length < 2) return null;

  const values = data.points.map((p) => p.value);
  const current = values[values.length - 1];
  const previous = values[values.length - 2] ?? current;
  const dayChange = current - previous;
  const dayPct = previous > 0 ? (dayChange / previous) * 100 : 0;
  const isUp = dayChange >= 0;

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 mb-2 w-full text-left"
      >
        <span className="text-sm font-bold text-text">Portfolio</span>
        <span className="font-mono text-sm font-semibold text-text">{fmt(current)}</span>
        <span className={`font-mono text-sm font-semibold ${isUp ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {isUp ? "+" : ""}{fmt(dayChange)} ({isUp ? "+" : ""}{dayPct.toFixed(1)}%)
        </span>
        <span className="text-text-dim text-xs ml-auto">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl p-4 space-y-4">
          {/* Chart */}
          <Sparkline data={values} width={600} height={80} />

          {/* Movers */}
          {(data.winners.length > 0 || data.losers.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {data.winners.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-text mb-2">Top gainers</div>
                  {data.winners.map((m) => (
                    <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-mono text-text-muted">{m.cardCode}</span>
                      <span className="font-mono font-semibold text-[#059669]">+{m.change}%</span>
                    </div>
                  ))}
                </div>
              )}
              {data.losers.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-text mb-2">Biggest drops</div>
                  {data.losers.map((m) => (
                    <div key={m.cardCode} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-mono text-text-muted">{m.cardCode}</span>
                      <span className="font-mono font-semibold text-[#DC2626]">{m.change}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grading opps */}
          {data.gradingOpps.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-text mb-2">Grading opportunities</div>
              {data.gradingOpps.map((g) => (
                <div key={g.cardCode} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="font-mono text-text-muted w-[80px]">{g.cardCode}</span>
                  <span className="text-text-dim">Raw {fmt(g.raw)}</span>
                  <span className="text-text-dim">→</span>
                  <span className="text-text">{g.grade} {fmt(g.gradedPrice)}</span>
                  <span className="font-mono font-semibold text-[#059669] ml-auto">+{g.roi}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to dashboard page**

In `src/app/(app)/page.tsx`, add import:

```typescript
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
```

And add between `<IntelTicker>` and `<CollectionShell>`:

```typescript
      <PortfolioDashboard />
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/portfolio-dashboard.tsx src/app/\(app\)/page.tsx
git commit -m "feat: add portfolio dashboard with chart, movers, grading opps"
```

---

### Task 10: Deals API and component

**Files:**
- Create: `src/app/api/deals/route.ts`
- Create: `src/components/deal-alerts.tsx`

- [ ] **Step 1: Create the deals endpoint**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dealAlerts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const deals = await db
    .select()
    .from(dealAlerts)
    .orderBy(desc(dealAlerts.discountPct))
    .limit(10);

  return NextResponse.json({
    deals: deals.map((d) => ({
      cardCode: d.cardCode,
      cardName: d.cardName,
      currentPrice: Number(d.currentPrice),
      avgPrice: Number(d.avgPrice),
      discountPct: Number(d.discountPct),
      imageUrl: d.imageUrl,
    })),
  }, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}
```

- [ ] **Step 2: Create the deal alerts component**

```typescript
"use client";

import { useEffect, useState } from "react";

type Deal = {
  cardCode: string;
  cardName: string;
  currentPrice: number;
  avgPrice: number;
  discountPct: number;
  imageUrl: string | null;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

const RETAILERS = [
  { name: "Total Cards", url: (q: string) => `https://www.totalcards.net/search?q=${encodeURIComponent(q)}` },
  { name: "Chaos Cards", url: (q: string) => `https://www.chaoscards.co.uk/search?q=${encodeURIComponent(q)}` },
  { name: "Cardmarket", url: (q: string) => `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(q)}` },
];

export function DealAlerts() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.deals) setDeals(d.deals); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || deals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-text mb-3">Deals — cards below market average</div>
      <div className="space-y-2">
        {deals.map((deal) => (
          <div key={deal.cardCode} className="flex items-center gap-3 bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl p-3">
            {deal.imageUrl && (
              <div className="w-10 h-[56px] rounded-md overflow-hidden bg-[#E4E4E7] flex-none">
                <img src={deal.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text truncate">{deal.cardName}</div>
              <div className="flex items-center gap-2 text-sm mt-0.5">
                <span className="font-mono font-semibold text-[#059669]">{fmt(deal.currentPrice)}</span>
                <span className="font-mono text-text-dim line-through">{fmt(deal.avgPrice)}</span>
                <span className="text-[11px] font-semibold text-[#059669] bg-[rgba(5,150,105,0.08)] px-1.5 py-0.5 rounded">
                  -{deal.discountPct}%
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-none">
              {RETAILERS.map((r) => (
                <a
                  key={r.name}
                  href={r.url(deal.cardName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-text-dim hover:text-text border border-[rgba(0,0,0,0.06)] rounded px-2 py-1 transition-colors"
                >
                  {r.name.split(" ")[0]}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add deals to What's Happening page**

In `src/components/intel-feed.tsx`, add import:

```typescript
import { DealAlerts } from "./deal-alerts";
```

Add `<DealAlerts />` right after the masthead section (after the `</div>` that closes the masthead), before the "Your cards banner" section.

- [ ] **Step 4: Verify build and commit**

Run: `npx next build`

```bash
git add src/app/api/deals/route.ts src/components/deal-alerts.tsx src/components/intel-feed.tsx
git commit -m "feat: add deal alerts with UK retailer links"
```

---

### Task 11: Pre-order tracker component

**Files:**
- Create: `src/components/preorder-tracker.tsx`
- Create: `src/app/api/preorders/route.ts`

- [ ] **Step 1: Create the preorders endpoint**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { preorderItems } from "@/lib/db/schema";
import { gte, sql } from "drizzle-orm";

export async function GET() {
  const now = new Date();

  const items = await db
    .select()
    .from(preorderItems)
    .where(gte(preorderItems.releaseDate, now))
    .orderBy(preorderItems.releaseDate);

  // Group by product
  const grouped = new Map<string, Array<typeof items[0]>>();
  for (const item of items) {
    if (!grouped.has(item.productName)) grouped.set(item.productName, []);
    grouped.get(item.productName)!.push(item);
  }

  const products = [...grouped.entries()].map(([name, retailers]) => {
    const cheapest = retailers.reduce((a, b) => (Number(a.price) < Number(b.price) ? a : b));
    return {
      name,
      setCode: retailers[0].setCode,
      releaseDate: retailers[0].releaseDate?.toISOString().split("T")[0] ?? null,
      retailers: retailers.map((r) => ({
        name: r.retailer,
        price: Number(r.price),
        currency: r.currency,
        url: r.url,
        inStock: r.inStock,
        isCheapest: r.id === cheapest.id,
      })),
    };
  });

  return NextResponse.json({ products }, {
    headers: { "Cache-Control": "public, s-maxage=600" },
  });
}
```

- [ ] **Step 2: Create the pre-order tracker component**

```typescript
"use client";

import { useEffect, useState } from "react";

type Product = {
  name: string;
  setCode: string | null;
  releaseDate: string | null;
  retailers: Array<{
    name: string;
    price: number;
    currency: string | null;
    url: string;
    inStock: boolean | null;
    isCheapest: boolean;
  }>;
};

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function PreorderTracker() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/preorders")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.products) setProducts(d.products); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-text mb-3">Upcoming releases</div>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.name} className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-semibold text-text">{product.name}</div>
              {product.releaseDate && (
                <div className="text-sm text-text-dim flex-none ml-3">
                  <span className="font-semibold text-text">{daysUntil(product.releaseDate)} days</span>
                  <span className="ml-1">— {new Date(product.releaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {product.retailers.map((r) => (
                <a
                  key={r.name}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition-colors ${
                    r.isCheapest
                      ? "border-[#059669] bg-[rgba(5,150,105,0.04)]"
                      : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
                  }`}
                >
                  <span className="text-text-muted">{r.name}</span>
                  <span className="font-mono font-semibold text-text">
                    {r.currency === "GBP" ? "£" : "€"}{r.price.toFixed(2)}
                  </span>
                  {r.isCheapest && (
                    <span className="text-[9px] font-semibold text-[#059669]">Cheapest</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add pre-orders to What's Happening page**

In `src/components/intel-feed.tsx`, add import:

```typescript
import { PreorderTracker } from "./preorder-tracker";
```

Add `<PreorderTracker />` right after `<DealAlerts />`, before "Your cards banner".

- [ ] **Step 4: Verify build and commit**

Run: `npx next build`

```bash
mkdir -p src/app/api/preorders
git add src/app/api/preorders/route.ts src/components/preorder-tracker.tsx src/components/intel-feed.tsx
git commit -m "feat: add pre-order tracker with UK retailer price comparison"
```

---

### Task 12: Deploy and verify

- [ ] **Step 1: Push schema to database**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_Xrw4Yp9fKsLI@ep-solitary-credit-ab60x2a0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" npx drizzle-kit push
```

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 3: Trigger price refresh to seed initial history**

Visit the app, go to Collections, click the refresh prices button. This will populate the first row of `card_price_history`.

- [ ] **Step 4: Commit all and push**

```bash
git add -A
git commit -m "feat: collector's bloomberg terminal — price charts, portfolio, deals, pre-orders"
git push origin main
```
