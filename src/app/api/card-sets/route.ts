import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setName = searchParams.get("set");

  const cards = getExtendedCards();

  if (setName) {
    // Get prices from the main catalog
    const catalog = await fetchCatalog();
    const priceMap = new Map(
      catalog.filter((c) => c.marketPrice != null).map((c) => [c.cardSetId.toUpperCase(), c.marketPrice])
    );

    const setCards = cards
      .filter((c) => c.setName === setName && c.type !== "DON")
      .sort((a, b) => a.cid.localeCompare(b.cid))
      .map((c) => ({
        cardSetId: c.cid,
        cardName: c.name,
        setName: c.setName,
        setId: "",
        rarity: c.rarity,
        cardColor: c.color,
        cardType: c.type,
        cardCost: c.cost != null ? String(c.cost) : "",
        cardPower: c.power != null ? String(c.power) : "",
        imageUrl: c.imageUrl,
        marketPrice: priceMap.get(c.cid.toUpperCase()) ?? null,
        inventoryPrice: null,
      }));

    return NextResponse.json(setCards, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  }

  // Return list of sets
  const setMap = new Map<string, { name: string; count: number; date: string | null }>();
  for (const c of cards) {
    if (!c.setName || c.type === "DON") continue;
    const existing = setMap.get(c.setName);
    if (existing) {
      existing.count++;
    } else {
      setMap.set(c.setName, { name: c.setName, count: 1, date: c.setDate });
    }
  }

  const sets = [...setMap.values()].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(sets, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
