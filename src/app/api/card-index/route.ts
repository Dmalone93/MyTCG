import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";

/** Lightweight card index for client-side scan matching */
export async function GET() {
  const cards = getExtendedCards();

  // Only send what's needed for matching — keep payload small
  const index = cards
    .filter((c) => c.type !== "DON")
    .map((c) => ({
      id: c.cid,
      n: c.name,
      r: c.rarity,
      c: c.color,
      img: c.imageUrl,
    }));

  return NextResponse.json(index, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
    },
  });
}
