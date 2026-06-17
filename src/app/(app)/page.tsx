import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, collectionCards, intelItems, dealAlerts } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [userCollections, cardCounts, recentIntel, recentDeals] = await Promise.all([
    db.select()
      .from(collections)
      .where(eq(collections.userId, user.id))
      .orderBy(collections.sortOrder, collections.createdAt),

    // Card counts per collection
    db.select({
      collectionId: collectionCards.collectionId,
      count: count(),
    })
      .from(collectionCards)
      .where(eq(collectionCards.userId, user.id))
      .groupBy(collectionCards.collectionId),

    db.select({
      id: intelItems.id,
      title: intelItems.title,
      category: intelItems.category,
      fetchedAt: intelItems.fetchedAt,
    })
      .from(intelItems)
      .orderBy(desc(intelItems.fetchedAt))
      .limit(3),

    db.select()
      .from(dealAlerts)
      .orderBy(desc(dealAlerts.detectedAt))
      .limit(3),
  ]);

  // Merge card counts into collections
  const countMap = new Map(cardCounts.map((c) => [c.collectionId, c.count]));
  const collectionsWithCounts = userCollections.map((col) => ({
    id: col.id,
    name: col.name,
    createdAt: col.createdAt,
    cardCount: countMap.get(col.id) ?? 0,
  }));

  return (
    <HomeDashboard
      collections={collectionsWithCounts}
      recentIntel={recentIntel}
      recentDeals={recentDeals}
    />
  );
}
