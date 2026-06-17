import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // Clerk user ID
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collectionCards = pgTable("collection_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  cardCode: text("card_code").notNull(),
  cardName: text("card_name").notNull(),
  quantity: integer("quantity").default(1),
  condition: text("condition"),
  isGraded: boolean("is_graded").default(false),
  grade: text("grade"),
  gradedCompany: text("graded_company"),
  acquiredPrice: numeric("acquired_price"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cardPrices = pgTable("card_prices", {
  cardCode: text("card_code").primaryKey(),
  rawMarket: numeric("raw_market"),
  gradedPrices: jsonb("graded_prices"),
  currency: text("currency").default("EUR"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    cardCode: text("card_code").notNull(),
    cardName: text("card_name").notNull(),
    imageUrl: text("image_url"),
    targetPrice: numeric("target_price"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("watchlist_user_card").on(table.userId, table.cardCode),
    index("idx_watchlist_user").on(table.userId),
  ]
);

export const intelItems = pgTable("intel_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category"),
  title: text("title").unique(),
  summary: text("summary"),
  source: text("source"),
  sourceUrl: text("source_url"),
  author: text("author"),
  imageUrl: text("image_url"),
  published: text("published"),
  urgent: boolean("urgent").default(false),
  jpOnly: boolean("jp_only").default(false),
  cardNames: text("card_names").array().default([]),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const cardPriceHistory = pgTable("card_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardCode: text("card_code").notNull(),
  price: numeric("price").notNull(),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.cardCode, table.recordedAt),
  index("idx_price_history_code_date").on(table.cardCode, table.recordedAt),
]);

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

// ═══ CARD CATALOG — variant-aware master registry ═══

/** Base cards — one row per unique gameplay card (OP01-047, ST01-001, P-001 etc.) */
export const cardCatalog = pgTable("card_catalog", {
  id: text("id").primaryKey(), // collector number: OP01-047, P-001
  name: text("name").notNull(),
  setId: text("set_id"), // OP-01, ST-01, P (promos)
  setName: text("set_name"),
  cardType: text("card_type"), // Leader, Character, Event, Stage
  color: text("color"),
  rarity: text("rarity"),
  cost: integer("cost"),
  power: integer("power"),
  life: integer("life"),
  counterPower: integer("counter_power"),
  traits: text("traits"),
  effect: text("effect"),
  imageUrl: text("image_url"),
  // Source tracking
  sources: text("sources").array().default([]), // ["optcgapi", "bandai", "tcgplayer", "manual"]
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Card variants — alternate printings of a base card (alt art, promo stamp, foil etc.) */
export const cardVariants = pgTable("card_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  baseCardId: text("base_card_id").notNull().references(() => cardCatalog.id),
  variantType: text("variant_type").notNull(), // "standard", "alt-art", "promo-stamped", "pre-release", "winner", "manga-art", "parallel", "foil"
  variantName: text("variant_name"), // e.g. "Alternate Art", "Tournament Pack", "Winner"
  imageUrl: text("image_url"),
  // Variant-specific pricing
  marketPrice: numeric("market_price"),
  currency: text("currency").default("GBP"),
  priceFetchedAt: timestamp("price_fetched_at"),
  // Source tracking
  source: text("source"), // "tcgplayer", "cardmarket", "manual", "justtcg"
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_variant_base").on(table.baseCardId),
  index("idx_variant_type").on(table.variantType),
]);

/** Missing card alerts — flagged by pipeline when pricing data references unknown cards */
export const missingCardAlerts = pgTable("missing_card_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardCode: text("card_code").notNull(),
  cardName: text("card_name"),
  detectedIn: text("detected_in").notNull(), // "justtcg", "tcgplayer", "scan"
  detectedPrice: numeric("detected_price"),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("missing_alert_code_source").on(table.cardCode, table.detectedIn),
]);

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
