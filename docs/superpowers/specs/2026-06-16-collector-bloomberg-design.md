# MyTCG: The Collector's Bloomberg Terminal

**Date:** 2026-06-16
**Status:** Approved for implementation

## Overview

Upgrade MyTCG from a collection tracker into an investor-grade tool for One Piece TCG collectors. Five new features layered on top of all existing functionality. Nothing is removed.

**Target users:** UK-based OPTCG collectors who buy, sell, grade, and pre-order cards to grow value. Eventually the wider community and deck builders.

**Benchmark:** TCGPlayer's price graphs and news quality, onepiece-cardgame.dev's card data, but with better UX, UK focus, and an investor angle none of them do well.

---

## 1. Price History & Charts

### Problem
Current prices are a single snapshot. No way to see if a card is trending up, down, or stable. Can't make informed buy/sell decisions.

### Solution
Store daily price snapshots. Show price history charts on every card detail view.

### Database
New table `card_price_history`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `card_code` TEXT NOT NULL
- `price` NUMERIC NOT NULL
- `recorded_at` DATE NOT NULL DEFAULT CURRENT_DATE
- UNIQUE(card_code, recorded_at)
- INDEX on (card_code, recorded_at DESC)

### Data Flow
1. Daily cron (`/api/refresh-prices`) already fetches prices from optcgapi
2. After updating `card_prices`, also INSERT into `card_price_history` (one row per card per day)
3. On conflict (same card + same date), UPDATE the price

### UI: Card Price Chart
- Shows in: CardDetailModal, CardDataSheet, Search detail
- Small sparkline by default (last 30 days, 80px tall)
- Tap/click to expand to full chart view
- Time range toggles: 7d | 30d | 90d | All
- SVG path rendering — no charting library dependency
- Current price, high, low, and % change for selected range displayed above chart

### UI: Grading ROI Calculator
- Shows below the price chart in card detail views
- Only appears when graded prices exist for the card
- Displays a simple table:
  - Grade | Graded Price | Raw Price | Difference | ROI %
  - e.g. PSA 10 | €89 | €15 | +€74 | +493%
- Estimated grading cost input (default €20) — user can adjust
- ROI recalculates with grading cost factored in
- Highlight the best ROI grade in green

---

## 2. Portfolio Dashboard

### Problem
Metric strip shows current totals but no trend. No way to see if your collection is growing or shrinking in value.

### Solution
Portfolio value chart and daily movers section between the intel ticker and collection.

### UI: Portfolio Value Chart
- Line chart showing total collection value over time
- Uses sum of (card price × quantity) for each date from `card_price_history`
- Same time toggles as card charts: 7d | 30d | 90d | All
- Above the chart: total value, daily change amount, daily change %
- Green if up, red if down

### UI: Top Movers
- 3 best performing cards (biggest % increase in last 7 days)
- 3 worst performing cards (biggest % decrease)
- Each shows: thumbnail, name, code, current price, % change
- Tap to open card detail

### UI: Grading Opportunities
- Cards in your collection where graded ROI exceeds a threshold (e.g. 200%+)
- Shows: thumbnail, name, raw price, best graded price, ROI %
- Max 5 cards, sorted by ROI descending
- Only shows if there are qualifying cards

### Placement
- Collapsible section on the main dashboard page
- Sits between intel ticker and collection
- Collapsed by default on mobile, expanded on desktop
- Heading: "Portfolio" with total value inline

---

## 3. Deal Alerts

### Problem
No way to spot when a card is unusually cheap. Deals expire before you know about them.

### Solution
Automated deal detection based on price history. Surface deals alongside news.

### Database
New table `deal_alerts`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `card_code` TEXT NOT NULL
- `card_name` TEXT NOT NULL
- `current_price` NUMERIC NOT NULL
- `avg_price` NUMERIC NOT NULL
- `discount_pct` NUMERIC NOT NULL
- `image_url` TEXT
- `detected_at` TIMESTAMPTZ DEFAULT NOW()
- UNIQUE(card_code)

### Data Flow
1. Daily cron runs after price refresh
2. For each card with 30+ days of price history:
   - Calculate 30-day average price
   - If current price is 20%+ below average, upsert into `deal_alerts`
   - If current price is back within 10% of average, delete the alert
3. Maximum 50 active deals stored (top by discount %)

### UI: Deal Alerts
- Section on the What's Happening page, above the news feed
- Heading: "Deals" with count
- Each deal shows:
  - Card thumbnail
  - Card name and code
  - Current price (large, green)
  - Average price (struck through)
  - Discount badge: "-32%"
  - "Buy" links to UK retailers: Total Cards, Chaos Cards, Cardmarket
  - Links constructed from card code/name URL patterns
- Watchlist matches highlighted with a badge
- Max 10 shown, sorted by discount %

### Retailer Links
- Total Cards: `https://www.totalcards.net/search?q={cardName}`
- Chaos Cards: `https://www.chaoscards.co.uk/search?q={cardName}`
- Cardmarket: `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString={cardName}`

---

## 4. Pre-order Tracker

### Problem
Pre-order info is scattered across retailer sites. Hard to compare prices or know what's coming.

### Solution
Structured pre-order data with price comparison, shown prominently on What's Happening.

### Database
New table `preorder_items`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `product_name` TEXT NOT NULL
- `set_code` TEXT
- `release_date` DATE
- `retailer` TEXT NOT NULL
- `price` NUMERIC NOT NULL
- `currency` TEXT DEFAULT 'GBP'
- `url` TEXT NOT NULL
- `in_stock` BOOLEAN DEFAULT TRUE
- `fetched_at` TIMESTAMPTZ DEFAULT NOW()
- UNIQUE(product_name, retailer)

### Data Flow
1. Intel scan already searches for UK pre-orders
2. When intel results contain pre-order data, also parse into `preorder_items`
3. AI prompt updated to return structured pre-order fields when category is `preorders_uk`
4. Alternatively: manual "Add pre-order" for products the AI misses

### UI: Pre-order Section
- Top of What's Happening page, before news feed
- Each upcoming product shown as a card:
  - Product name (e.g. "OP-17 Booster Box")
  - Release date with countdown: "August 15 — 60 days"
  - Retailer price comparison in a row:
    - Total Cards £89 | Chaos Cards £85 | Cardmarket £82
  - "Cheapest" badge on lowest price
  - Each price is a link to the retailer page
- Products sorted by release date (soonest first)
- Past release dates auto-hidden

---

## 5. UI Polish Pass

### Problem
App needs to feel like a real product, not a prototype. Consistency, loading states, empty states, transitions.

### Changes
- Consistent border radius (8px for small elements, 12px for cards/modals)
- Consistent padding scale (px-4 for content, px-5 for modal internals)
- Loading skeletons instead of "Loading..." text
- Smooth transitions on section expand/collapse (max-height animation)
- Empty state illustrations or icons instead of plain text
- Error states with retry buttons instead of silent failures
- Consistent button height: 44px on mobile, 36px on desktop
- Consistent font scale: body 14px, headings follow a clear hierarchy

---

## Technical Notes

### No new external dependencies
- Price charts: SVG path rendering, no charting library
- All data from existing APIs (optcgapi, onepiece-cardgame.dev) + price history we collect

### Cron updates
- Existing daily cron at 6 AM: add price history recording + deal detection
- Pre-order parsing added to intel scan cron at 6 PM

### Performance
- Price history queries scoped to single card + date range (indexed)
- Portfolio chart aggregated server-side, cached for 5 minutes
- Deal alerts table is small (max 50 rows), no performance concern
- Pre-order items table is small (max 30 rows)

### Migration path
- Price history starts empty, builds over time. Charts show "Not enough data" until 7+ days
- Deal alerts start empty, first deals appear after 30 days of price history
- Pre-orders populate on next intel scan

---

## What is NOT changing

All existing features remain:
- Collection management (add, edit, delete, move, multi-select from sets)
- Card scanning (camera on mobile, screen capture on desktop)
- Quick scan to add
- Search page with list/grid toggle
- Intel/What's Happening news feed with newspaper layout
- Watch mode with screen capture and pop-out widget
- Watchlist and recommendations (on Watch tab)
- Card detail modals with extended data, synergies
- Hover preview on thumbnails
- Mobile responsive UI
- Clerk authentication
- All existing API routes
