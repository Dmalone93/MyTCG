@AGENTS.md

# MyTCG — One Piece TCG Collection Tracker

## What this is
A Next.js 16 web app for One Piece TCG card collectors. Tracks collections, shows market prices, scans cards, provides intel/news, and helps users make buy/sell/grade decisions. Deployed on Vercel at `mytcg-dmalone93s-projects.vercel.app`.

## Tech Stack
- **Framework**: Next.js 16 App Router (Turbopack)
- **Database**: Neon Postgres via Drizzle ORM
- **Auth**: Clerk (`@clerk/nextjs`) — middleware in `src/proxy.ts`
- **Styling**: Tailwind CSS v4 — light mode, warm off-white (#F8F7F4), One Piece red accent (#C4170C)
- **Deployment**: Vercel (account: dmalone93)
- **APIs**: optcgapi.com (card catalog + prices), JustTCG (live pricing), Google Cloud Vision (card scanning), Anthropic Claude Haiku (intel/news)

## Key Files
- `src/lib/db/schema.ts` — all DB tables (collections, cards, prices, price_history, deals, preorders, watchlist, intel)
- `src/lib/catalog/extended-cards.ts` — 1,609-card extended database loader
- `src/lib/catalog/fetch-catalog.ts` — optcgapi catalog fetcher (cached in memory)
- `src/lib/charts/` — SVG sparkline + interactive price chart
- `src/proxy.ts` — Clerk middleware (NOT `middleware.ts`)
- `src/components/collection-shell.tsx` — main collection page state manager
- `src/components/card-grid.tsx` — card list/grid views + toolbar
- `src/components/card-detail-modal.tsx` — card detail with data table, price chart, grading ROI, marketplace links
- `src/components/card-data-sheet.tsx` — standalone card detail (used in search/watch)
- `src/components/intel-feed.tsx` — What's Happening news page
- `src/components/scan-modal.tsx` — camera scanner with evidence accumulation
- `src/components/mobile-nav.tsx` — bottom navigation bar (mobile only)
- `src/components/region-selector.tsx` — UK/EU/US currency toggle
- `src/app/(app)/layout.tsx` — app shell (NO async, no currentUser — that was a perf bottleneck)
- `src/app/(app)/browse/page.tsx` — browse all cards by set with color filter + sort
- `src/app/(app)/watch/page.tsx` — screen capture card detection with PiP widget
- `src/app/(app)/search/page.tsx` — card search with sort + list/grid
- `src/app/(app)/settings/page.tsx` — user settings (region, collections CRUD, default view)

## API Routes
- `/api/search-cards` — search optcgapi catalog
- `/api/card-info` — extended card data + synergies from JSON DB
- `/api/card-sets` — list sets or cards in a set (merged extended + catalog)
- `/api/card-index` — lightweight card index for client-side scan matching
- `/api/live-price` — on-demand JustTCG pricing (100/day free tier limit)
- `/api/price-history` — historical prices from our DB
- `/api/portfolio` — portfolio value, movers, grading opportunities
- `/api/deals` — cards below 30-day average
- `/api/preorders` — upcoming releases with retailer prices
- `/api/recommendations` — collection-based card recommendations
- `/api/watchlist` — watchlist CRUD
- `/api/collections` — collections CRUD
- `/api/refresh-prices` — daily cron: updates prices, records history, detects deals
- `/api/scan-card` — Google Vision OCR for card scanning
- `/api/scan-intel` — Claude Haiku web search for news (7 categories, OG image fetching)

## Database
Neon Postgres. Connection: `postgresql://neondb_owner:npg_Xrw4Yp9fKsLI@ep-solitary-credit-ab60x2a0-pooler.eu-west-2.aws.neon.tech/neondb`

Tables: profiles, collections, collection_cards, card_prices, card_price_history, deal_alerts, preorder_items, intel_items, watchlist

Push schema: `DATABASE_URL="..." npx drizzle-kit push`

## Environment Variables (Vercel)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth (test keys)
- `DATABASE_URL` — Neon Postgres (empty in Vercel env, actual value above)
- `ANTHROPIC_API_KEY` — Claude Haiku for intel scanning
- `GOOGLE_CLOUD_VISION_API_KEY` — card scanning OCR
- `JUSTTCG_API_KEY` — live pricing (`tcg_25da419580304eefb7e45817db26929a`)
- Various `POSTGRES_*` / `PG*` vars from Neon integration

## Git / Deployment
- **GitHub**: `Dmalone93/MyTCG` — must use `gh auth switch --user Dmalone93`
- **Vercel**: `dmalone93s-projects/mytcg` — deploy with `vercel --prod`
- User also has a work account (`declandfyne` / DFYNE) — don't mix them

## Design System
- **Background**: #F8F7F4 (warm off-white), surfaces #F0EFEC, elevated #FFFFFF
- **Text**: #1A1A1A, muted #6B6B6B, dim #9CA3AF
- **Accent**: #C4170C (One Piece red) — used sparingly (active tabs, scan button)
- **Green**: #059669 (prices up), **Red**: #DC2626 (prices down)
- **Borders**: rgba(0,0,0,0.05-0.1)
- **Corners**: rounded-2xl for cards/modals, rounded-full for pills/buttons
- **Typography**: Geist Sans/Mono, minimum 12px (text-xs), editorial feel
- **Mobile**: bottom nav bar (Home|Browse|Scan|News|Profile), search bar in header
- **Desktop**: top nav with logo, links, search pill, region picker, settings, avatar

## User Preferences (from memory)
- Has dyslexia — minimum 14px for body text, readable fonts
- UK-based collector — needs UK retailer links (Total Cards, Chaos Cards, eBay UK)
- Prefers minimalist editorial design — Wise-inspired, newspaper layouts
- Hover previews on thumbnails only, not card names
- No loud blue CTAs — subtle borders, text links
- Intel ticker was removed (too noisy)
- Building toward a real product for the OPTCG community

## Known Issues / TODO
- Search should function exactly like Browse (color filters, sort controls)
- Price history charts need data to accumulate (daily cron must run)
- JustTCG free tier: 100 requests/day — use sparingly
- Extended card JSON only covers OP-01 to OP-08 — newer sets use optcgapi
- Watch mode (screen capture) only works on desktop Chrome
- Deck builder planned for Phase 2
- eBay/Cardmarket real pricing integration would replace currency conversion

## Specs & Plans
- `docs/superpowers/specs/2026-06-16-collector-bloomberg-design.md` — Bloomberg terminal spec
- `docs/superpowers/plans/2026-06-16-collector-bloomberg.md` — implementation plan (completed)
