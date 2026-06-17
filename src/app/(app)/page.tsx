import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, collectionCards, cardPrices, intelItems, dealAlerts } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [userCollections, recentIntel, recentDeals] = await Promise.all([
    // Collections with card count and total value
    db.select({
      id: collections.id,
      name: collections.name,
      createdAt: collections.createdAt,
      cardCount: sql<number>`(SELECT COUNT(*) FROM collection_cards WHERE collection_id = ${collections.id})`,
    })
      .from(collections)
      .where(eq(collections.userId, user.id))
      .orderBy(collections.sortOrder, collections.createdAt),

    // Recent intel headlines
    db.select({
      id: intelItems.id,
      title: intelItems.title,
      category: intelItems.category,
      fetchedAt: intelItems.fetchedAt,
    })
      .from(intelItems)
      .orderBy(desc(intelItems.fetchedAt))
      .limit(3),

    // Recent deals
    db.select()
      .from(dealAlerts)
      .orderBy(desc(dealAlerts.detectedAt))
      .limit(3),
  ]);

  return (
    <HomeDashboard
      collections={userCollections}
      recentIntel={recentIntel}
      recentDeals={recentDeals}
    />
  );
}
