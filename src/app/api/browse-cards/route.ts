import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function GET() {
  const extCards = getExtendedCards();
  const catalog = await fetchCatalog();

  // Build a lookup map for extended cards by CID (uppercase)
  const extMap = new Map(extCards.map((e) => [e.cid.toUpperCase(), e]));

  // Build price map
  const priceMap = new Map(
    catalog
      .filter((c) => c.marketPrice != null)
      .map((c) => [c.cardSetId.toUpperCase(), c.marketPrice])
  );

  // Track unique filter values
  const setMap = new Map<string, { id: string; name: string }>();
  const raritySet = new Set<string>();
  const typeSet = new Set<string>();

  // Base colors only — multi-color cards get matched via "includes"
  const BASE_COLORS = ["Red", "Blue", "Green", "Purple", "Black", "Yellow"];

  // Enrich all catalog cards with extended data
  const cards = catalog.map((c) => {
    const ext = extMap.get(c.cardSetId.toUpperCase());

    const rarity = ext?.rarity ?? c.rarity;
    const cardColor = ext?.color ?? c.cardColor;
    const cardType = ext?.type ?? c.cardType;

    // Collect filter values
    if (c.setId && c.setName) {
      setMap.set(c.setId, { id: c.setId, name: c.setName });
    }
    if (rarity) raritySet.add(rarity);
    if (cardType) typeSet.add(cardType);

    // Slim payload — only fields needed for browse/filter/display
    return {
      cardSetId: c.cardSetId,
      cardName: c.cardName,
      setName: c.setName,
      setId: c.setId,
      rarity,
      cardColor,
      cardType,
      imageUrl: ext?.imageUrl ?? c.imageUrl,
      marketPrice: priceMap.get(c.cardSetId.toUpperCase()) ?? c.marketPrice ?? null,
    };
  });

  // Sort sets by prefix then numeric part
  const sets = [...setMap.values()].sort((a, b) => {
    const prefA = a.id.replace(/[\d-]/g, "");
    const prefB = b.id.replace(/[\d-]/g, "");
    if (prefA !== prefB) return prefA.localeCompare(prefB);
    const numA = parseInt(a.id.match(/\d+/)?.[0] ?? "999");
    const numB = parseInt(b.id.match(/\d+/)?.[0] ?? "999");
    return numA - numB;
  });

  const colors = BASE_COLORS;
  const rarities = [...raritySet].sort((a, b) => a.localeCompare(b));
  const types = [...typeSet].sort((a, b) => a.localeCompare(b));

  return NextResponse.json(
    {
      cards,
      filters: {
        sets,
        colors,
        rarities,
        types,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  );
}
