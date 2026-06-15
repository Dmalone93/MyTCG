# TCG Collection Tracker + Live Intel Feed — Design Spec

## Overview

A public, multi-user web app for trading card collectors (focus: One Piece TCG, but card-game-agnostic). Users track collections of cards, see live market prices and graded-value projections, organise cards into multiple named collections, and get a live news/intel feed about new releases.

## Stack

- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS
- **Backend/DB:** Supabase (Postgres + Auth + Row Level Security)
- **Deploy:** Vercel
- **Pricing:** PriceCharting as default provider (pluggable interface)
- **Intel:** Anthropic API (claude-sonnet-4-6 + web_search tool), cron every 6h

## Aesthetic

Dark terminal / CRT theme:
- Background: `#080A08` (near-black)
- Green accent system
- IBM Plex Mono for UI labels
- Refined serif for content text
- Clean, dense, data-forward. No generic AI styling.

## Critical Constraints

### Pricing Provider
- **DO NOT** integrate Cardmarket directly (API closed to new applications, terms prohibit this use case)
- Build a `PriceProvider` interface (`getPrice`, `getGradedPrices`, `search`)
- Default implementation: PriceCharting (licenses graded + sealed price data)
- Cardmarket adapter: stub that throws "not enabled"
- All provider keys server-side only. Never expose to client. Never accept user-supplied credentials.

### Security (public signups)
- Supabase Auth (email/password + magic link)
- Every user-data table has RLS: user can only read/write their own rows
- Service role only for shared tables (card_prices, intel_items)
- Cron routes protected with CRON_SECRET bearer check

## Data Model

```sql
-- profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- collections (a user can have many)
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- cards in a collection
create table collection_cards (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  card_code text not null,
  card_name text not null,
  quantity int default 1,
  condition text,
  is_graded boolean default false,
  grade text,
  graded_company text,
  acquired_price numeric,
  notes text,
  image_url text,
  created_at timestamptz default now()
);

-- cached prices (refreshed by job, keyed by card_code)
create table card_prices (
  card_code text primary key,
  raw_market numeric,
  graded_prices jsonb,
  currency text default 'EUR',
  fetched_at timestamptz default now()
);

-- intel feed (shared across all users, written by cron)
create table intel_items (
  id uuid primary key default gen_random_uuid(),
  category text,
  title text unique,
  summary text,
  source text,
  published text,
  urgent boolean default false,
  jp_only boolean default false,
  card_names text[] default '{}',
  fetched_at timestamptz default now()
);
```

### RLS Policies

- `profiles`: SELECT/INSERT/UPDATE where `id = auth.uid()`
- `collections`: SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- `collection_cards`: SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- `card_prices`: SELECT for all authenticated users; INSERT/UPDATE for service role only
- `intel_items`: SELECT for all authenticated users; INSERT/UPDATE for service role only

### Trigger

- On `auth.users` INSERT, create a `profiles` row with `id = new.id`

## Build Phases

### Phase 1 — Auth + Shell
- Supabase Auth: signup, login, logout, magic link
- Profile row created on signup via DB trigger
- Protected app layout; redirect unauthenticated users to login
- CRT/terminal theme applied to shell

### Phase 2 — Collections as Tabs
- Top-level tabs, one per collection. "+" tab to create new collection inline.
- Rename collection, reorder tabs
- Card grid/table inside each tab
- Collection total market value + graded-value projection
- Empty state with "add card" affordance

### Phase 3 — Pricing Provider
- `lib/pricing/provider.ts` — PriceProvider interface
- `lib/pricing/pricecharting.ts` — default implementation
- `lib/pricing/cardmarket.ts` — stub
- Server route / scheduled job to refresh card_prices
- Per-collection totals read from cached prices

### Phase 4 — Card Interactions
- Tap/click card -> modal with full details, price ladder, P/L, edit fields
- Long-press / right-click -> context menu (move to collection, delete)
- Long-press: pointer-down timer ~500ms, cancel on pointermove/up
- Optimistic UI updates, persist to Supabase

### Phase 5 — Intel Feed
- `app/api/scan-intel/route.ts`: cron-protected, calls Anthropic API with web_search
- Categories: TCG Japan, TCG English, SEC/alt arts, anime, manga, prices
- Parse results into intel_items, extract card codes/names, dedupe by title
- vercel.json cron every 6 hours
- Feed UI with `revalidate = 300`
- Cross-link: flag user's cards that appear in intel items

## Acceptance Checks
- Second test user cannot see first user's collections (RLS verified)
- No API keys in any client bundle
- Page loads serve cached prices/intel instantly; refreshes in background/on schedule
- Long-press works on touch, doesn't misfire on tap
- Creating, renaming, switching, deleting collections all persist
