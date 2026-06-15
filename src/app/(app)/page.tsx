import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, intelItems } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CollectionShell } from "@/components/collection-shell";
import { IntelTicker } from "@/components/intel-ticker";
import { Recommendations } from "@/components/recommendations";
import { Watchlist } from "@/components/watchlist";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const userCollections = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, user.id))
    .orderBy(collections.sortOrder, collections.createdAt);

  // Fetch recent intel for ticker + cross-linking
  const recentIntel = await db
    .select()
    .from(intelItems)
    .orderBy(desc(intelItems.fetchedAt))
    .limit(20);

  const intelCardNames = new Set<string>();
  recentIntel.forEach((item) => {
    (item.cardNames ?? []).forEach((name) => {
      intelCardNames.add(name.toUpperCase());
      intelCardNames.add(name.toLowerCase());
    });
  });

  return (
    <>
      <IntelTicker items={recentIntel} />
      <Watchlist />
      <Recommendations />
      <CollectionShell
        initialCollections={userCollections}
        intelCardNames={[...intelCardNames]}
      />
    </>
  );
}
