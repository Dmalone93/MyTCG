import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardCatalog } from "@/lib/db/schema";

/**
 * GET /api/card-index
 * Lightweight card index for client-side scan matching.
 * Reads from card_catalog DB.
 */
export async function GET() {
  const cards = await db.select({
    id: cardCatalog.id,
    name: cardCatalog.name,
    rarity: cardCatalog.rarity,
    color: cardCatalog.color,
    imageUrl: cardCatalog.imageUrl,
  }).from(cardCatalog);

  const index = cards.map((c) => ({
    id: c.id,
    n: c.name,
    r: c.rarity ?? "",
    c: c.color ?? "",
    img: c.imageUrl ?? "",
  }));

  return NextResponse.json(index, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
    },
  });
}
