import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { collectionCards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recommendForCollection } from "@/lib/catalog/extended-cards";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = await db
    .select({ cardCode: collectionCards.cardCode })
    .from(collectionCards)
    .where(eq(collectionCards.userId, userId));

  const codes = cards.map((c) => c.cardCode);

  if (codes.length === 0) {
    return NextResponse.json({ recommendations: [], message: "Add cards to get recommendations" });
  }

  const recommendations = recommendForCollection(codes, 12);

  // Get prices from catalog
  const catalog = await fetchCatalog();
  const priceMap = new Map(
    catalog.filter((c) => c.marketPrice != null).map((c) => [c.cardSetId.toUpperCase(), c.marketPrice])
  );

  return NextResponse.json({
    recommendations: recommendations.map((r) => ({
      cardSetId: r.cid,
      cardName: r.name,
      type: r.type,
      color: r.color,
      rarity: r.rarity,
      traits: r.traits,
      power: r.power,
      cost: r.cost,
      imageUrl: r.imageUrl,
      setName: r.setName,
      altArt: r.altArt,
      effect: r.effect.slice(0, 200),
      marketPrice: priceMap.get(r.cid.toUpperCase()) ?? null,
    })),
    basedOn: codes.length,
  }, {
    headers: {
      "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
