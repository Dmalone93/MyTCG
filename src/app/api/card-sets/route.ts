import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setId = searchParams.get("set"); // Now uses set ID like "OP-01"

  const extCards = getExtendedCards();
  const catalog = await fetchCatalog();

  if (setId) {
    // Build price map
    const priceMap = new Map(
      catalog.filter((c) => c.marketPrice != null).map((c) => [c.cardSetId.toUpperCase(), c.marketPrice])
    );

    // Get catalog cards for this set (by setId)
    const catalogSetCards = catalog
      .filter((c) => c.setId === setId)
      .map((c) => {
        // Try to enrich with extended data
        const ext = extCards.find((e) => e.cid.toUpperCase() === c.cardSetId.toUpperCase());
        return {
          cardSetId: c.cardSetId,
          cardName: c.cardName,
          setName: c.setName,
          setId: c.setId,
          rarity: ext?.rarity ?? c.rarity,
          cardColor: ext?.color ?? c.cardColor,
          cardType: ext?.type ?? c.cardType,
          cardCost: ext?.cost != null ? String(ext.cost) : c.cardCost,
          cardPower: ext?.power != null ? String(ext.power) : c.cardPower,
          imageUrl: ext?.imageUrl ?? c.imageUrl,
          marketPrice: priceMap.get(c.cardSetId.toUpperCase()) ?? c.marketPrice ?? null,
          inventoryPrice: c.inventoryPrice ?? null,
        };
      })
      .sort((a, b) => a.cardSetId.localeCompare(b.cardSetId));

    // If no catalog results, fall back to extended cards by set name
    if (catalogSetCards.length === 0) {
      const extSetCards = extCards
        .filter((c) => c.setName === setId && c.type !== "DON")
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
      return NextResponse.json(extSetCards, {
        headers: { "Cache-Control": "public, s-maxage=3600" },
      });
    }

    return NextResponse.json(catalogSetCards, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  }

  // Build set list from catalog (primary source — has all sets)
  const setMap = new Map<string, { name: string; id: string; count: number }>();

  for (const c of catalog) {
    if (!c.setId || !c.setName) continue;
    const existing = setMap.get(c.setId);
    if (existing) existing.count++;
    else setMap.set(c.setId, { name: `${c.setName}`, id: c.setId, count: 1 });
  }

  const sets = [...setMap.values()]
    .sort((a, b) => {
      // Extract numeric part for ordering
      const numA = parseInt((a.id.match(/\d+/)?.[0]) ?? "999");
      const numB = parseInt((b.id.match(/\d+/)?.[0]) ?? "999");
      // Group by prefix first
      const prefA = a.id.replace(/[\d-]/g, "");
      const prefB = b.id.replace(/[\d-]/g, "");
      if (prefA !== prefB) return prefA.localeCompare(prefB);
      return numA - numB;
    })
    .map((s) => ({
      name: s.name,
      id: s.id,
      count: s.count,
      date: null as string | null,
    }));

  return NextResponse.json(sets, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
