import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectionCards, cardPrices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPriceProvider } from "@/lib/pricing";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getPriceProvider();

  const cards = await db
    .select({ cardCode: collectionCards.cardCode })
    .from(collectionCards);

  const codes = [...new Set(cards.map((c) => c.cardCode))];

  if (codes.length === 0) {
    return NextResponse.json({ message: "No cards to refresh", updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const code of codes) {
    try {
      const result = await provider.getPrice(code);
      if (!result) {
        errors.push(`${code}: no result`);
        continue;
      }

      await db
        .insert(cardPrices)
        .values({
          cardCode: code,
          rawMarket: result.rawMarket != null ? String(result.rawMarket) : null,
          gradedPrices: result.gradedPrices,
          currency: result.currency,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: cardPrices.cardCode,
          set: {
            rawMarket: result.rawMarket != null ? String(result.rawMarket) : null,
            gradedPrices: result.gradedPrices,
            currency: result.currency,
            fetchedAt: new Date(),
          },
        });

      updated++;
    } catch (err) {
      errors.push(
        `${code}: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({
    message: `Refreshed ${updated}/${codes.length} prices`,
    updated,
    total: codes.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
