import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setName = searchParams.get("set");

  const extCards = getExtendedCards();
  const catalog = await fetchCatalog();

  if (setName) {
    // Merge: extended cards + catalog cards for this set
    const priceMap = new Map(
      catalog.filter((c) => c.marketPrice != null).map((c) => [c.cardSetId.toUpperCase(), c.marketPrice])
    );

    // Start with extended cards for this set
    const extSetCards = extCards
      .filter((c) => c.setName === setName && c.type !== "DON")
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

    // Add catalog cards not in extended DB
    const extCodes = new Set(extSetCards.map((c) => c.cardSetId.toUpperCase()));
    const catalogSetCards = catalog
      .filter((c) => c.setName === setName && !extCodes.has(c.cardSetId.toUpperCase()))
      .map((c) => ({
        ...c,
        marketPrice: c.marketPrice ?? null,
        inventoryPrice: c.inventoryPrice ?? null,
      }));

    const allCards = [...extSetCards, ...catalogSetCards].sort((a, b) => a.cardSetId.localeCompare(b.cardSetId));

    return NextResponse.json(allCards, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  }

  // Build set list from BOTH sources
  const setMap = new Map<string, { name: string; count: number; date: string | null }>();

  // Extended cards
  for (const c of extCards) {
    if (!c.setName || c.type === "DON") continue;
    const existing = setMap.get(c.setName);
    if (existing) existing.count++;
    else setMap.set(c.setName, { name: c.setName, count: 1, date: c.setDate });
  }

  // Catalog cards — add sets not already listed
  for (const c of catalog) {
    if (!c.setName) continue;
    const existing = setMap.get(c.setName);
    if (existing) {
      // Only increment if this card isn't already counted from extended
      const extMatch = extCards.find((e) => e.cid.toUpperCase() === c.cardSetId.toUpperCase());
      if (!extMatch) existing.count++;
    } else {
      setMap.set(c.setName, { name: c.setName, count: 1, date: null });
    }
  }

  const sets = [...setMap.values()]
    .filter((s) => s.count > 0)
    .sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json(sets, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
