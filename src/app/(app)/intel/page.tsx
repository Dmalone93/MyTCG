import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { intelItems, collectionCards } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { IntelFeed } from "@/components/intel-feed";

export const revalidate = 300;

export default async function IntelPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Run both queries in parallel
  const [items, userCards] = await Promise.all([
    db.select().from(intelItems).orderBy(desc(intelItems.fetchedAt)).limit(100),
    db.select({ cardCode: collectionCards.cardCode, cardName: collectionCards.cardName })
      .from(collectionCards).where(eq(collectionCards.userId, user.id)),
  ]);

  const userCardCodes = new Set(userCards.map((c) => c.cardCode.toUpperCase()));
  const userCardNames = new Set(userCards.map((c) => c.cardName.toLowerCase()));

  const enrichedItems = items.map((item) => {
    const mentionsUserCard = (item.cardNames ?? []).some(
      (name) =>
        userCardCodes.has(name.toUpperCase()) ||
        userCardNames.has(name.toLowerCase())
    );
    return { ...item, mentionsUserCard };
  });

  return <IntelFeed items={enrichedItems} />;
}
