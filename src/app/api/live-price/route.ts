import { NextResponse } from "next/server";

type JustTCGVariant = {
  condition: string;
  printing: string;
  price: number | null;
  priceChange7d: number | null;
  priceChange30d: number | null;
  priceChange90d: number | null;
  avgPrice7d: number | null;
  avgPrice30d: number | null;
  minPrice7d: number | null;
  maxPrice7d: number | null;
  minPrice30d: number | null;
  maxPrice30d: number | null;
  trendSlope7d: number | null;
  trendSlope30d: number | null;
  minPriceAllTime: number | null;
  maxPrice1y: number | null;
  minPrice1y: number | null;
};

type JustTCGCard = {
  name: string;
  number: string;
  rarity: string;
  set_name: string;
  variants: JustTCGVariant[];
};

export async function GET(request: Request) {
  const key = process.env.JUSTTCG_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "JustTCG API key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const cardCode = searchParams.get("code") ?? "";
  const cardName = searchParams.get("name") ?? "";

  if (!cardCode && !cardName) {
    return NextResponse.json({ error: "Provide code or name" }, { status: 400 });
  }

  try {
    // Search by card name or number
    const query = cardName || cardCode;
    const res = await fetch(
      `https://api.justtcg.com/v1/cards?game=one-piece-card-game&name=${encodeURIComponent(query)}&limit=5`,
      { headers: { "x-api-key": key } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `JustTCG API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const cards: JustTCGCard[] = data.data ?? [];

    // Find the best match — prefer exact number match
    let match = cards.find((c) => c.number?.toUpperCase() === cardCode.toUpperCase());
    if (!match && cards.length > 0) {
      // Filter out sealed products
      match = cards.find((c) => c.rarity !== "None" && c.number !== "N/A") ?? cards[0];
    }

    if (!match || match.variants.length === 0) {
      return NextResponse.json({ found: false }, {
        headers: { "Cache-Control": "public, s-maxage=3600" },
      });
    }

    // Get the Near Mint / Normal variant as primary
    const nmVariant = match.variants.find(
      (v) => v.condition === "Near Mint" && v.printing === "Normal"
    ) ?? match.variants.find(
      (v) => v.condition === "Near Mint"
    ) ?? match.variants[0];

    // Collect all printing variants with prices
    const variants = match.variants
      .filter((v) => v.price && v.price > 0)
      .map((v) => ({
        condition: v.condition,
        printing: v.printing,
        price: v.price ? v.price / 100 : null, // Convert cents to dollars
        change7d: v.priceChange7d,
        change30d: v.priceChange30d,
        change90d: v.priceChange90d,
        avg30d: v.avgPrice30d ? v.avgPrice30d / 100 : null,
        min30d: v.minPrice30d ? v.minPrice30d / 100 : null,
        max30d: v.maxPrice30d ? v.maxPrice30d / 100 : null,
        trend7d: v.trendSlope7d,
        trend30d: v.trendSlope30d,
        allTimeLow: v.minPriceAllTime ? v.minPriceAllTime / 100 : null,
        yearHigh: v.maxPrice1y ? v.maxPrice1y / 100 : null,
        yearLow: v.minPrice1y ? v.minPrice1y / 100 : null,
      }));

    const price = nmVariant.price ? nmVariant.price / 100 : null;

    return NextResponse.json({
      found: true,
      name: match.name,
      number: match.number,
      rarity: match.rarity,
      set: match.set_name,
      price,
      change7d: nmVariant.priceChange7d,
      change30d: nmVariant.priceChange30d,
      change90d: nmVariant.priceChange90d,
      avg30d: nmVariant.avgPrice30d ? nmVariant.avgPrice30d / 100 : null,
      yearHigh: nmVariant.maxPrice1y ? nmVariant.maxPrice1y / 100 : null,
      yearLow: nmVariant.minPrice1y ? nmVariant.minPrice1y / 100 : null,
      allTimeLow: nmVariant.minPriceAllTime ? nmVariant.minPriceAllTime / 100 : null,
      trend: nmVariant.trendSlope30d != null
        ? nmVariant.trendSlope30d > 0 ? "rising" : nmVariant.trendSlope30d < 0 ? "falling" : "stable"
        : null,
      variants,
    }, {
      headers: { "Cache-Control": "public, s-maxage=1800" }, // Cache 30 min
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch price" },
      { status: 500 }
    );
  }
}
