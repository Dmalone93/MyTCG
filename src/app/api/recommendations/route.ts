import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { collectionCards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recommendForCollection, findExtended } from "@/lib/catalog/extended-cards";

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
    })),
    basedOn: codes.length,
  }, {
    headers: {
      "Cache-Control": "private, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
