import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dealAlerts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const deals = await db
    .select()
    .from(dealAlerts)
    .orderBy(desc(dealAlerts.discountPct))
    .limit(10);

  return NextResponse.json({
    deals: deals.map((d) => ({
      cardCode: d.cardCode,
      cardName: d.cardName,
      currentPrice: Number(d.currentPrice),
      avgPrice: Number(d.avgPrice),
      discountPct: Number(d.discountPct),
      imageUrl: d.imageUrl,
    })),
  }, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}
