import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
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

export const intelItems = pgTable("intel_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category"),
  title: text("title").unique(),
  summary: text("summary"),
  source: text("source"),
  published: text("published"),
  urgent: boolean("urgent").default(false),
  jpOnly: boolean("jp_only").default(false),
  cardNames: text("card_names").array().default([]),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});
