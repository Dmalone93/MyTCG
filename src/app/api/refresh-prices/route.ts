import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collectionCards, cardPrices, cardPriceHistory, dealAlerts } from "@/lib/db/schema";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";
import { sql } from "drizzle-orm";

/**
 * POST /api/refresh-prices
 * Refreshes cached prices from optcgapi.com catalog.
 * Accepts either CRON_SECRET (for Vercel cron) or Clerk auth (for manual trigger).
 */
export async function POST(request: Request) {
  // Check cron secret OR Clerk auth
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const cronAuth = secret && authHeader === `Bearer ${secret}`;

  if (!cronAuth) {
    try {
      const { userId } = await auth();
      if (!userId) { /* allow public route */ }
    } catch { /* proceed */ }
  }

  const cards = await db
    .select({ cardCode: collectionCards.cardCode })
    .from(collectionCards);

  const codes = [...new Set(cards.map((c) => c.cardCode))];
  if (codes.length === 0) {
    return NextResponse.json({ message: "No cards to refresh", updated: 0 });
  }

  const catalog = await fetchCatalog();
  const catalogMap = new Map(catalog.map((c) => [c.cardSetId, c]));

  let updated = 0;

  for (const code of codes) {
    const card = catalogMap.get(code);
    if (!card || card.marketPrice == null) continue;

    await db
      .insert(cardPrices)
      .values({
        cardCode: code,
        rawMarket: String(card.marketPrice),
        gradedPrices: null,
        currency: "EUR",
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cardPrices.cardCode,
        set: {
          rawMarket: String(card.marketPrice),
          currency: "EUR",
          fetchedAt: new Date(),
        },
      });

    updated++;
  }

  // Record price history
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const code of codes) {
    const card = catalogMap.get(code);
    if (!card || card.marketPrice == null) continue;

    await db
      .insert(cardPriceHistory)
      .values({
        cardCode: code,
        price: String(card.marketPrice),
        recordedAt: today,
      })
      .onConflictDoNothing();
  }

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

  return NextResponse.json({
    message: `Refreshed ${updated}/${codes.length} prices from optcgapi.com`,
    updated,
    total: codes.length,
    dealsInserted,
  });
}
