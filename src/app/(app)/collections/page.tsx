import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collections, intelItems } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CollectionShell } from "@/components/collection-shell";

export default async function CollectionsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [userCollections, recentIntel] = await Promise.all([
    db.select().from(collections)
      .where(eq(collections.userId, user.id))
      .orderBy(collections.sortOrder, collections.createdAt),
    db.select().from(intelItems)
      .orderBy(desc(intelItems.fetchedAt))
      .limit(20),
  ]);

  const intelCardNames = new Set<string>();
  recentIntel.forEach((item) => {
    (item.cardNames ?? []).forEach((name: string) => {
      intelCardNames.add(name.toUpperCase());
      intelCardNames.add(name.toLowerCase());
    });
  });

  return (
    <CollectionShell
      initialCollections={userCollections}
      intelCardNames={[...intelCardNames]}
    />
  );
}
