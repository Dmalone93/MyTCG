-- =============================================================
-- TCG Collection Tracker — Initial Schema (Vercel Postgres)
-- Run via: npx drizzle-kit push
-- Or paste in Neon/Vercel Postgres console
-- =============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  card_code TEXT NOT NULL,
  card_name TEXT NOT NULL,
  quantity INT DEFAULT 1,
  condition TEXT,
  is_graded BOOLEAN DEFAULT FALSE,
  grade TEXT,
  graded_company TEXT,
  acquired_price NUMERIC,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_prices (
  card_code TEXT PRIMARY KEY,
  raw_market NUMERIC,
  graded_prices JSONB,
  currency TEXT DEFAULT 'EUR',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  title TEXT UNIQUE,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  author TEXT,
  image_url TEXT,
  published TEXT,
  urgent BOOLEAN DEFAULT FALSE,
  jp_only BOOLEAN DEFAULT FALSE,
  card_names TEXT[] DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  card_code TEXT NOT NULL,
  card_name TEXT NOT NULL,
  image_url TEXT,
  target_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_code)
);

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

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_user ON collection_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_collection ON collection_cards(collection_id);
CREATE INDEX IF NOT EXISTS idx_card_prices_fetched ON card_prices(fetched_at);
CREATE INDEX IF NOT EXISTS idx_intel_items_fetched ON intel_items(fetched_at DESC);
