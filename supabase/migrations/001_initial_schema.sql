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

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_user ON collection_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_collection ON collection_cards(collection_id);
CREATE INDEX IF NOT EXISTS idx_card_prices_fetched ON card_prices(fetched_at);
CREATE INDEX IF NOT EXISTS idx_intel_items_fetched ON intel_items(fetched_at DESC);
