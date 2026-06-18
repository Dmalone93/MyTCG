import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardCatalog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/card-sets — list all sets (no param) or cards in a set (?set=OP-01)
 * Now reads from card_catalog DB instead of external API.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setId = searchParams.get("set");

  if (setId) {
    // Cards in a specific set
    const cards = await db.select().from(cardCatalog).where(eq(cardCatalog.setId, setId));

    const mapped = cards
      .map((c) => ({
        cardSetId: c.id,
        cardName: c.name,
        setName: c.setName ?? "",
        setId: c.setId ?? "",
        rarity: c.rarity ?? "",
        cardColor: c.color ?? "",
        cardType: c.cardType ?? "",
        cardCost: c.cost != null ? String(c.cost) : "",
        cardPower: c.power != null ? String(c.power) : "",
        imageUrl: c.imageUrl ?? "",
        marketPrice: null as number | null,
        inventoryPrice: null as number | null,
      }))
      .sort((a, b) => a.cardSetId.localeCompare(b.cardSetId));

    return NextResponse.json(mapped, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  }

  // List all sets
  const all = await db.select({
    setId: cardCatalog.setId,
    setName: cardCatalog.setName,
  }).from(cardCatalog);

  const setMap = new Map<string, { name: string; id: string; count: number }>();
  for (const c of all) {
    if (!c.setId || !c.setName) continue;
    const existing = setMap.get(c.setId);
    if (existing) existing.count++;
    else setMap.set(c.setId, { name: c.setName, id: c.setId, count: 1 });
  }

  const sets = [...setMap.values()]
    .sort((a, b) => {
      const prefA = a.id.replace(/[\d-]/g, "");
      const prefB = b.id.replace(/[\d-]/g, "");
      if (prefA !== prefB) return prefA.localeCompare(prefB);
      const numA = parseInt((a.id.match(/\d+/)?.[0]) ?? "999");
      const numB = parseInt((b.id.match(/\d+/)?.[0]) ?? "999");
      return numA - numB;
    })
    .map((s) => ({ name: s.name, id: s.id, count: s.count, date: null as string | null }));

  return NextResponse.json(sets, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
