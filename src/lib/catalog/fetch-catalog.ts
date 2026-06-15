import type { CatalogCard } from "./types";

let cachedCatalog: CatalogCard[] | null = null;
let fetchPromise: Promise<CatalogCard[]> | null = null; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents

function normalize(raw: Record<string, unknown>): CatalogCard | null {
  const id = String(raw.card_set_id ?? "");
  const name = String(raw.card_name ?? "");
  if (!id || !name) return null;

  return {
    cardSetId: id,
    cardName: name,
    setName: String(raw.set_name ?? ""),
    setId: String(raw.set_id ?? ""),
    rarity: String(raw.rarity ?? ""),
    cardColor: String(raw.card_color ?? ""),
    cardType: String(raw.card_type ?? ""),
    cardCost: String(raw.card_cost ?? ""),
    cardPower: String(raw.card_power ?? ""),
    imageUrl: raw.card_image
      ? String(raw.card_image)
      : `https://optcgapi.com/media/static/Card_Images/${id}.jpg`,
    marketPrice:
      typeof raw.market_price === "number" ? raw.market_price : null,
    inventoryPrice:
      typeof raw.inventory_price === "number" ? raw.inventory_price : null,
  };
}

export async function fetchCatalog(): Promise<CatalogCard[]> {
  if (cachedCatalog) return cachedCatalog;

  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const res = await fetch("https://optcgapi.com/api/allSetCards/");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data)
          ? data
          : data.results ?? data.data ?? data.cards ?? [];
        const result = arr
          .map((c: Record<string, unknown>) => normalize(c))
          .filter((c: CatalogCard | null): c is CatalogCard => c !== null);
        cachedCatalog = result;
        return result;
      } catch (err) {
        console.error("Failed to fetch catalog:", err);
        fetchPromise = null;
        return [];
      }
    })();
  }

  return fetchPromise;
}

export function searchCatalog(
  catalog: CatalogCard[],
  query: string,
  limit = 40
): CatalogCard[] {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q.length < 1) return [];

  const matches = catalog.filter((c) => {
    const haystack = (c.cardName + c.cardSetId)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return haystack.includes(q);
  });

  // Sort: exact number prefix → name prefix → rest, then by price desc
  matches.sort((a, b) => {
    const aN = a.cardSetId.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bN = b.cardSetId.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aName = a.cardName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bName = b.cardName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const aNumMatch = aN.startsWith(q) ? 0 : 1;
    const bNumMatch = bN.startsWith(q) ? 0 : 1;
    if (aNumMatch !== bNumMatch) return aNumMatch - bNumMatch;

    const aNameMatch = aName.startsWith(q) ? 0 : 1;
    const bNameMatch = bName.startsWith(q) ? 0 : 1;
    if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;

    // Price descending
    return (b.marketPrice ?? 0) - (a.marketPrice ?? 0);
  });

  return matches.slice(0, limit);
}
