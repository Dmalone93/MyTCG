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
