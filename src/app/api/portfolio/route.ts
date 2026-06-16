import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { collectionCards, cardPriceHistory, cardPrices } from "@/lib/db/schema";
import { eq, and, gte, sql, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  try {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = Math.min(parseInt(searchParams.get("range") ?? "30") || 30, 365);

  const userCards = await db
    .select({ cardCode: collectionCards.cardCode, quantity: collectionCards.quantity })
    .from(collectionCards)
    .where(eq(collectionCards.userId, userId));

  if (userCards.length === 0) {
    return NextResponse.json({ points: [], winners: [], losers: [], gradingOpps: [] });
  }

  const cardMap = new Map<string, number>();
  for (const c of userCards) {
    cardMap.set(c.cardCode, (cardMap.get(c.cardCode) ?? 0) + (c.quantity ?? 1));
  }

  const codes = [...cardMap.keys()];
  const since = new Date();
  since.setDate(since.getDate() - range);

  const history = await db
    .select({ cardCode: cardPriceHistory.cardCode, price: cardPriceHistory.price, date: cardPriceHistory.recordedAt })
    .from(cardPriceHistory)
    .where(and(inArray(cardPriceHistory.cardCode, codes), gte(cardPriceHistory.recordedAt, since)))
    .orderBy(cardPriceHistory.recordedAt);

  const dateMap = new Map<string, number>();
  for (const row of history) {
    const dateStr = row.date.toISOString().split("T")[0];
    const qty = cardMap.get(row.cardCode) ?? 1;
    dateMap.set(dateStr, (dateMap.get(dateStr) ?? 0) + Number(row.price) * qty);
  }

  const points = [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const currentPrices = await db.select().from(cardPrices).where(inArray(cardPrices.cardCode, codes));
  const oldPrices = await db
    .select({ cardCode: cardPriceHistory.cardCode, price: cardPriceHistory.price })
    .from(cardPriceHistory)
    .where(and(inArray(cardPriceHistory.cardCode, codes), sql`${cardPriceHistory.recordedAt}::date = ${sevenDaysAgo.toISOString().split("T")[0]}::date`));

  const oldMap = new Map(oldPrices.map((p) => [p.cardCode, Number(p.price)]));

  const movers = currentPrices
    .map((p) => {
      const current = Number(p.rawMarket ?? 0);
      const old = oldMap.get(p.cardCode);
      if (!old || old === 0 || current === 0) return null;
      return { cardCode: p.cardCode, current, old, change: Math.round(((current - old) / old) * 1000) / 10 };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null && Math.abs(m.change) > 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const winners = movers.filter((m) => m.change > 0).slice(0, 3);
  const losers = movers.filter((m) => m.change < 0).slice(0, 3);

  const gradingOpps = currentPrices
    .map((p) => {
      const raw = Number(p.rawMarket ?? 0);
      if (raw <= 0) return null;
      const graded = p.gradedPrices as Record<string, number> | null;
      if (!graded) return null;
      const best = Object.entries(graded).reduce((b, [g, pr]) => (pr > b.price ? { grade: g, price: pr } : b), { grade: "", price: 0 });
      if (best.price <= raw) return null;
      const roi = ((best.price - raw - 20) / (raw + 20)) * 100;
      return { cardCode: p.cardCode, raw, gradedPrice: best.price, grade: best.grade, roi: Math.round(roi) };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.roi >= 100)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  return NextResponse.json({ points, winners, losers, gradingOpps }, {
    headers: { "Cache-Control": "private, s-maxage=300" },
  });
  } catch (err) {
    console.error("Portfolio error:", err);
    return NextResponse.json({ points: [], winners: [], losers: [], gradingOpps: [] });
  }
}
