import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, collectionCards, cardPrices, intelItems, dealAlerts, cardCatalog } from "@/lib/db/schema";
import { eq, desc, count, inArray, sql } from "drizzle-orm";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [userCollections, cardCounts, allUserCards, recentIntel, recentDeals] = await Promise.all([
    db.select().from(collections)
      .where(eq(collections.userId, user.id))
      .orderBy(collections.sortOrder, collections.createdAt),

    db.select({ collectionId: collectionCards.collectionId, count: count() })
      .from(collectionCards)
      .where(eq(collectionCards.userId, user.id))
      .groupBy(collectionCards.collectionId),

    db.select({
      cardCode: collectionCards.cardCode,
      cardName: collectionCards.cardName,
      quantity: collectionCards.quantity,
      acquiredPrice: collectionCards.acquiredPrice,
      imageUrl: collectionCards.imageUrl,
      collectionId: collectionCards.collectionId,
      createdAt: collectionCards.createdAt,
    })
      .from(collectionCards)
      .where(eq(collectionCards.userId, user.id)),

    db.select({
      id: intelItems.id, title: intelItems.title, summary: intelItems.summary,
      category: intelItems.category, source: intelItems.source, author: intelItems.author,
      imageUrl: intelItems.imageUrl, fetchedAt: intelItems.fetchedAt,
    }).from(intelItems).orderBy(desc(intelItems.fetchedAt)).limit(6),

    db.select().from(dealAlerts).orderBy(desc(dealAlerts.detectedAt)).limit(3),
  ]);

  // Get prices for all user's cards
  let priceMap = new Map<string, number>();
  if (allUserCards.length > 0) {
    const codes = [...new Set(allUserCards.map((c) => c.cardCode))];
    const prices = await db.select().from(cardPrices).where(inArray(cardPrices.cardCode, codes));
    priceMap = new Map(prices.map((p) => [p.cardCode, Number(p.rawMarket ?? 0)]));
  }

  // Portfolio totals
  let totalValue = 0;
  let totalSpent = 0;
  for (const card of allUserCards) {
    const qty = card.quantity ?? 1;
    totalValue += (priceMap.get(card.cardCode) ?? 0) * qty;
    totalSpent += Number(card.acquiredPrice ?? 0) * qty;
  }

  // Top valuable cards (unique by code, sorted by value)
  const cardValues = new Map<string, { code: string; name: string; imageUrl: string | null; value: number }>();
  for (const card of allUserCards) {
    const price = priceMap.get(card.cardCode) ?? 0;
    if (price > 0 && !cardValues.has(card.cardCode)) {
      cardValues.set(card.cardCode, { code: card.cardCode, name: card.cardName, imageUrl: card.imageUrl, value: price });
    }
  }
  const topCards = [...cardValues.values()].sort((a, b) => b.value - a.value).slice(0, 6);

  // Recently added (last 5)
  const recentlyAdded = [...allUserCards]
    .filter((c) => c.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5)
    .map((c) => ({
      code: c.cardCode, name: c.cardName, imageUrl: c.imageUrl,
      price: priceMap.get(c.cardCode) ?? 0,
    }));

  // Set completion — count user's cards per set vs total in catalog
  const userSetCounts = new Map<string, number>();
  for (const card of allUserCards) {
    const setId = card.cardCode.replace(/-\d+$/, "").replace(/(\D+)(\d+)/, "$1-$2");
    userSetCounts.set(setId, (userSetCounts.get(setId) ?? 0) + 1);
  }

  let setCompletion: Array<{ setId: string; owned: number; total: number }> = [];
  if (userSetCounts.size > 0) {
    const setCounts = await db.select({
      setId: cardCatalog.setId,
      total: count(),
    }).from(cardCatalog).groupBy(cardCatalog.setId);

    const totalMap = new Map(setCounts.map((s) => [s.setId, s.total]));
    setCompletion = [...userSetCounts.entries()]
      .map(([setId, owned]) => ({
        setId,
        owned,
        total: totalMap.get(setId) ?? owned,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.owned - a.owned)
      .slice(0, 5);
  }

  // Collection thumbnails + values
  const thumbMap = new Map<string, string[]>();
  const valueMap = new Map<string, number>();
  for (const tc of allUserCards) {
    if (tc.imageUrl) {
      const arr = thumbMap.get(tc.collectionId) ?? [];
      if (arr.length < 10) arr.push(tc.imageUrl);
      thumbMap.set(tc.collectionId, arr);
    }
    const price = priceMap.get(tc.cardCode) ?? 0;
    valueMap.set(tc.collectionId, (valueMap.get(tc.collectionId) ?? 0) + price * (tc.quantity ?? 1));
  }

  const countMap = new Map(cardCounts.map((c) => [c.collectionId, c.count]));
  const collectionsWithCounts = userCollections.map((col) => ({
    id: col.id, name: col.name, createdAt: col.createdAt,
    cardCount: countMap.get(col.id) ?? 0,
    thumbnails: thumbMap.get(col.id) ?? [],
    totalValue: valueMap.get(col.id) ?? 0,
  }));

  return (
    <HomeDashboard
      collections={collectionsWithCounts}
      portfolioValue={totalValue}
      portfolioSpent={totalSpent}
      topCards={topCards}
      recentlyAdded={recentlyAdded}
      setCompletion={setCompletion}
      recentIntel={recentIntel}
      recentDeals={recentDeals}
    />
  );
}
