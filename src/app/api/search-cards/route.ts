import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardCatalog } from "@/lib/db/schema";

/**
 * GET /api/search-cards?q=...
 * Searches card_catalog DB table by name or code.
 * No external API dependency.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 1) {
    return NextResponse.json([]);
  }

  // Pull all cards and search in memory (catalog is ~3.5k rows, fast enough)
  const all = await db.select().from(cardCatalog);

  const qLower = q.toLowerCase().replace(/[^a-z0-9]/g, "");

  const matches = all.filter((c) => {
    const haystack = (c.name + c.id).toLowerCase().replace(/[^a-z0-9]/g, "");
    return haystack.includes(qLower);
  });

  // Sort: exact code match first, then name prefix, then by name
  matches.sort((a, b) => {
    const aCode = a.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bCode = b.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aName = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bName = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    const aCodeMatch = aCode.startsWith(qLower) ? 0 : 1;
    const bCodeMatch = bCode.startsWith(qLower) ? 0 : 1;
    if (aCodeMatch !== bCodeMatch) return aCodeMatch - bCodeMatch;

    const aNameMatch = aName.startsWith(qLower) ? 0 : 1;
    const bNameMatch = bName.startsWith(qLower) ? 0 : 1;
    if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;

    return a.name.localeCompare(b.name);
  });

  const results = matches.slice(0, 30).map((c) => ({
    cardSetId: c.id,
    cardName: c.name,
    setName: c.setName ?? "",
    setId: c.setId ?? "",
    rarity: c.rarity ?? "",
    cardColor: c.color ?? "",
    cardType: c.cardType ?? "",
    cardCost: c.cost != null ? String(c.cost) : "",
    cardPower: c.power != null ? String(c.power) : "",
    cardText: c.effect ?? "",
    subTypes: c.traits ?? "",
    life: c.life != null ? String(c.life) : "",
    counterAmount: c.counterPower != null ? String(c.counterPower) : "",
    imageUrl: c.imageUrl ?? "",
    marketPrice: null as number | null,
    inventoryPrice: null as number | null,
  }));

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
