import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, collectionCards, cardPrices, intelItems, dealAlerts } from "@/lib/db/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [userCollections, cardCounts, userCards, recentIntel, recentDeals] = await Promise.all([
    db.select()
      .from(collections)
      .where(eq(collections.userId, user.id))
      .orderBy(collections.sortOrder, collections.createdAt),

    db.select({
      collectionId: collectionCards.collectionId,
      count: count(),
    })
      .from(collectionCards)
      .where(eq(collectionCards.userId, user.id))
      .groupBy(collectionCards.collectionId),

    // All user's cards for portfolio calculation
    db.select({
      cardCode: collectionCards.cardCode,
      quantity: collectionCards.quantity,
      acquiredPrice: collectionCards.acquiredPrice,
    })
      .from(collectionCards)
      .where(eq(collectionCards.userId, user.id)),

    db.select({
      id: intelItems.id,
      title: intelItems.title,
      summary: intelItems.summary,
      category: intelItems.category,
      source: intelItems.source,
      author: intelItems.author,
      imageUrl: intelItems.imageUrl,
      fetchedAt: intelItems.fetchedAt,
    })
      .from(intelItems)
      .orderBy(desc(intelItems.fetchedAt))
      .limit(6),

    db.select()
      .from(dealAlerts)
      .orderBy(desc(dealAlerts.detectedAt))
      .limit(3),
  ]);

  // Calculate portfolio value from card_prices
  let totalValue = 0;
  let totalSpent = 0;
  if (userCards.length > 0) {
    const codes = [...new Set(userCards.map((c) => c.cardCode))];
    const prices = await db.select().from(cardPrices).where(inArray(cardPrices.cardCode, codes));
    const priceMap = new Map(prices.map((p) => [p.cardCode, Number(p.rawMarket ?? 0)]));

    for (const card of userCards) {
      const qty = card.quantity ?? 1;
      const price = priceMap.get(card.cardCode) ?? 0;
      totalValue += price * qty;
      totalSpent += Number(card.acquiredPrice ?? 0) * qty;
    }
  }

  // Get card thumbnails + per-collection value
  let priceMap = new Map<string, number>();
  if (userCards.length > 0) {
    const codes = [...new Set(userCards.map((c) => c.cardCode))];
    const prices = await db.select().from(cardPrices).where(inArray(cardPrices.cardCode, codes));
    priceMap = new Map(prices.map((p) => [p.cardCode, Number(p.rawMarket ?? 0)]));
  }

  const allCards = userCards.length > 0
    ? await db.select({ collectionId: collectionCards.collectionId, cardCode: collectionCards.cardCode, quantity: collectionCards.quantity, imageUrl: collectionCards.imageUrl })
        .from(collectionCards)
        .where(eq(collectionCards.userId, user.id))
    : [];

  const thumbMap = new Map<string, string[]>();
  const valueMap = new Map<string, number>();
  for (const tc of allCards) {
    // Thumbnails
    if (tc.imageUrl) {
      const arr = thumbMap.get(tc.collectionId) ?? [];
      if (arr.length < 3) arr.push(tc.imageUrl);
      thumbMap.set(tc.collectionId, arr);
    }
    // Value
    const price = priceMap.get(tc.cardCode) ?? 0;
    const qty = tc.quantity ?? 1;
    valueMap.set(tc.collectionId, (valueMap.get(tc.collectionId) ?? 0) + price * qty);
  }

  const countMap = new Map(cardCounts.map((c) => [c.collectionId, c.count]));
  const collectionsWithCounts = userCollections.map((col) => ({
    id: col.id,
    name: col.name,
    createdAt: col.createdAt,
    cardCount: countMap.get(col.id) ?? 0,
    thumbnails: thumbMap.get(col.id) ?? [],
    totalValue: valueMap.get(col.id) ?? 0,
  }));

  return (
    <HomeDashboard
      collections={collectionsWithCounts}
      portfolioValue={totalValue}
      portfolioSpent={totalSpent}
      recentIntel={recentIntel}
      recentDeals={recentDeals}
    />
  );
}
