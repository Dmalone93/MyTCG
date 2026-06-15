import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectionCards, cardPrices } from "@/lib/db/schema";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

/**
 * POST /api/refresh-prices
 * Refreshes cached prices from optcgapi.com catalog for all cards in collections.
 * Protected by CRON_SECRET.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all card codes in collections
  const cards = await db
    .select({ cardCode: collectionCards.cardCode })
    .from(collectionCards);

  const codes = [...new Set(cards.map((c) => c.cardCode))];
  if (codes.length === 0) {
    return NextResponse.json({ message: "No cards to refresh", updated: 0 });
  }

  // Fetch the full catalog and index by card code
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

  return NextResponse.json({
    message: `Refreshed ${updated}/${codes.length} prices from optcgapi.com`,
    updated,
    total: codes.length,
  });
}
