import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardPriceHistory } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";
  const range = searchParams.get("range") ?? "30";

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const days = Math.min(parseInt(range) || 30, 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await db
    .select({
      price: cardPriceHistory.price,
      date: cardPriceHistory.recordedAt,
    })
    .from(cardPriceHistory)
    .where(
      and(
        eq(cardPriceHistory.cardCode, code.toUpperCase()),
        gte(cardPriceHistory.recordedAt, since)
      )
    )
    .orderBy(cardPriceHistory.recordedAt);

  const points = history.map((h) => ({
    price: Number(h.price),
    date: h.date.toISOString().split("T")[0],
  }));

  const prices = points.map((p) => p.price);
  const high = prices.length > 0 ? Math.max(...prices) : 0;
  const low = prices.length > 0 ? Math.min(...prices) : 0;
  const current = prices.length > 0 ? prices[prices.length - 1] : 0;
  const first = prices.length > 0 ? prices[0] : 0;
  const change = first > 0 ? ((current - first) / first) * 100 : 0;

  return NextResponse.json({
    points,
    high,
    low,
    current,
    change: Math.round(change * 10) / 10,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}
