import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardCatalog, cardPrices } from "@/lib/db/schema";

/**
 * GET /api/browse-cards
 * Returns all cards from our own card_catalog DB table.
 * No external API dependency — fast, owned data.
 */
export async function GET() {
  const [cards, prices] = await Promise.all([
    db.select().from(cardCatalog),
    db.select().from(cardPrices),
  ]);

  const priceMap = new Map(prices.map((p) => [p.cardCode, Number(p.rawMarket ?? 0)]));

  // Build filter metadata
  const setMap = new Map<string, { id: string; name: string }>();
  const colorSet = new Set<string>();
  const raritySet = new Set<string>();
  const typeSet = new Set<string>();

  const BASE_COLORS = ["Red", "Blue", "Green", "Purple", "Black", "Yellow"];

  const mapped = cards.map((c) => {
    if (c.setId && c.setName) setMap.set(c.setId, { id: c.setId, name: c.setName });
    if (c.rarity) raritySet.add(c.rarity);
    if (c.cardType) typeSet.add(c.cardType);

    return {
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
      marketPrice: priceMap.get(c.id) ?? null,
    };
  });

  // Sort sets
  const sets = [...setMap.values()].sort((a, b) => {
    const prefA = a.id.replace(/[\d-]/g, "");
    const prefB = b.id.replace(/[\d-]/g, "");
    if (prefA !== prefB) return prefA.localeCompare(prefB);
    const numA = parseInt(a.id.match(/\d+/)?.[0] ?? "999");
    const numB = parseInt(b.id.match(/\d+/)?.[0] ?? "999");
    return numA - numB;
  });

  return NextResponse.json(
    {
      cards: mapped,
      filters: {
        sets,
        colors: BASE_COLORS,
        rarities: [...raritySet].sort(),
        types: [...typeSet].sort(),
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  );
}
