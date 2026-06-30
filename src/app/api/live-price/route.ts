import { NextResponse } from "next/server";

type CardMarketCard = {
  id: number;
  name: string;
  card_code_number: string;
  card_number: string;
  rarity: string;
  version: string;
  prices: {
    cardmarket?: {
      currency: string;
      lowest_near_mint: number | null;
      lowest_near_mint_EU_only: number | null;
      "30d_average": number | null;
      "7d_average": number | null;
      available_items: number | null;
      graded: Array<Record<string, unknown>>;
    };
    tcg_player?: {
      currency: string;
      market_price: number | null;
      mid_price?: number | null;
    };
  };
  episode?: {
    name: string;
    code: string;
  };
  image?: string;
};

const BASE_URL = "https://cardmarket-api-tcg.p.rapidapi.com";

/** Set code → CardMarket episode ID for fallback lookup */
const EPISODE_MAP: Record<string, number> = {
  EB05: 418, OP17: 417, OP16: 416, OP15: 404, EB03: 394,
  OP14: 348, ST29: 349, OP13: 350, PRB02: 351, ST22: 360,
  OP12: 361, ST24: 352, ST23: 353, ST25: 354, ST26: 355,
  ST27: 356, OP11: 362, ST28: 363, EB02: 359, OP10: 364,
  ST21: 365, OP09: 366, PRB01: 367, ST20: 381, ST18: 382,
  ST17: 383, ST16: 384, ST15: 385, ST19: 389, OP08: 386,
  ST14: 387, OP07: 391, EB01: 390, ST13: 388, OP06: 373,
  ST12: 380, ST11: 392, OP05: 372, ST10: 379, OP04: 371,
  ST09: 378, ST08: 393, OP03: 370, ST07: 377, OP02: 369,
  ST06: 376, ST05: 395, ST01: 357, ST02: 358, OP01: 368,
  ST03: 374, ST04: 375, EB04: 396,
};

function normalizeCode(c: CardMarketCard): string {
  return (c.card_number ?? c.card_code_number ?? "").toUpperCase();
}

function codeMatches(c: CardMarketCard, code: string): boolean {
  const upper = code.toUpperCase();
  return normalizeCode(c) === upper
    || (c.card_code_number ?? "").toUpperCase() === upper;
}

/** Extract set code from a card code, e.g. "OP16-056" → "OP16" */
function extractSet(cardCode: string): string | null {
  const m = cardCode.match(/^([A-Z]+\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

/** Extract card number from code, e.g. "OP16-056" → 56 */
function extractCardNum(cardCode: string): number {
  const m = cardCode.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function apiFetch(path: string, key: string): Promise<CardMarketCard[]> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "cardmarket-api-tcg.p.rapidapi.com",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

export async function GET(request: Request) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return NextResponse.json({ error: "RapidAPI key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const cardCode = searchParams.get("code") ?? "";
  const cardName = searchParams.get("name") ?? "";

  if (!cardCode && !cardName) {
    return NextResponse.json({ error: "Provide code or name" }, { status: 400 });
  }

  try {
    const query = cardCode || cardName;
    let cards = await apiFetch(
      `/one-piece/cards?search=${encodeURIComponent(query)}&sort=relevance`,
      key
    );

    // Check if we found the card by code
    let codeHits = cardCode
      ? cards.filter((c) => codeMatches(c, cardCode))
      : [];

    // Fallback: if search didn't find the card, try the episode endpoint
    if (codeHits.length === 0 && cardCode) {
      const setCode = extractSet(cardCode);
      const episodeId = setCode ? EPISODE_MAP[setCode] : null;

      if (episodeId) {
        const cardNum = extractCardNum(cardCode);
        // Estimate page: ~15 unique cards per page (20 entries including variants)
        const estPage = Math.max(1, Math.ceil(cardNum / 13));

        // Try estimated page and adjacent pages
        for (const page of [estPage, estPage + 1, estPage - 1]) {
          if (page < 1) continue;
          const episodeCards = await apiFetch(
            `/one-piece/episodes/${episodeId}/cards?sort=card_number_lowest&page=${page}`,
            key
          );
          const hits = episodeCards.filter((c) => codeMatches(c, cardCode));
          if (hits.length > 0) {
            codeHits = hits;
            cards = episodeCards;
            break;
          }
        }
      }
    }

    if (codeHits.length === 0 && cards.length === 0) {
      return NextResponse.json({ found: false }, {
        headers: { "Cache-Control": "public, s-maxage=3600" },
      });
    }

    // Pick the primary match
    let match: CardMarketCard;
    if (codeHits.length > 0) {
      // Prefer V.1 (standard) for primary price
      match = codeHits.find((c) => c.version === "V.1")
        ?? codeHits.find((c) => !c.version || c.version === "None")
        ?? codeHits[0];
    } else {
      match = cards.find((c) => c.rarity && c.rarity !== "None" && c.rarity !== "DON!!") ?? cards[0];
      // Try to find matching cards by name if no code match
      codeHits = cards.filter((c) => c.name === match.name && c.card_number === match.card_number);
      if (codeHits.length === 0) codeHits = [match];
    }

    const cm = match.prices?.cardmarket;
    const tcg = match.prices?.tcg_player;

    const priceEur = cm?.lowest_near_mint ?? cm?.["30d_average"] ?? null;
    const priceUsd = tcg?.market_price ?? null;

    // ALL versions of this card code as variants (with images)
    const variants = codeHits.map((c) => ({
      version: c.version,
      rarity: c.rarity,
      name: c.name,
      image: c.image ?? null,
      priceEur: c.prices?.cardmarket?.lowest_near_mint ?? c.prices?.cardmarket?.["30d_average"] ?? null,
      priceUsd: c.prices?.tcg_player?.market_price ?? null,
      avg30dEur: c.prices?.cardmarket?.["30d_average"] ?? null,
      avg7dEur: c.prices?.cardmarket?.["7d_average"] ?? null,
      available: c.prices?.cardmarket?.available_items ?? null,
    }));

    return NextResponse.json({
      found: true,
      name: match.name,
      number: normalizeCode(match) || cardCode,
      rarity: match.rarity,
      version: match.version,
      set: match.episode?.name ?? "",
      image: match.image ?? null,
      // Dual pricing
      priceEur,
      priceUsd,
      // Cardmarket details (EUR)
      avg30dEur: cm?.["30d_average"] ?? null,
      avg7dEur: cm?.["7d_average"] ?? null,
      lowestNmEur: cm?.lowest_near_mint ?? null,
      availableItems: cm?.available_items ?? null,
      // TCGPlayer details (USD)
      tcgMarketUsd: tcg?.market_price ?? null,
      // Legacy compat
      price: priceUsd ?? (priceEur != null ? priceEur * 1.09 : null),
      // Trend
      trend: cm?.["7d_average"] != null && cm?.["30d_average"] != null
        ? cm["7d_average"]! > cm["30d_average"]! * 1.02 ? "rising"
          : cm["7d_average"]! < cm["30d_average"]! * 0.98 ? "falling"
          : "stable"
        : null,
      variants,
      source: "cardmarket",
    }, {
      headers: { "Cache-Control": "public, s-maxage=1800" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch price" },
      { status: 500 }
    );
  }
}
