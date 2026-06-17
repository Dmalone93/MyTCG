import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cardCatalog, cardVariants, missingCardAlerts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

/**
 * POST /api/pipeline/sync
 * Multi-source reconciliation — batch upserts for speed.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const cronAuth = secret && authHeader === `Bearer ${secret}`;

  if (!cronAuth) {
    try {
      const { userId } = await auth();
      if (!userId) { /* allow if public route */ }
    } catch { /* proceed */ }
  }

  const stats = { catalogCards: 0, upserted: 0, errors: [] as string[] };

  try {
    const catalog = await fetchCatalog();
    stats.catalogCards = catalog.length;

    // Batch upsert in chunks of 100
    const BATCH_SIZE = 20; // Neon param limit ~32K, 20 cards × 16 fields = 320 params
    for (let i = 0; i < catalog.length; i += BATCH_SIZE) {
      const batch = catalog.slice(i, i + BATCH_SIZE).filter((c) => c.cardSetId && c.cardName);

      if (batch.length === 0) continue;

      const values = batch.map((card) => ({
        id: card.cardSetId,
        name: card.cardName,
        setId: card.setId || null,
        setName: card.setName || null,
        cardType: card.cardType || null,
        color: card.cardColor || null,
        rarity: card.rarity || null,
        cost: card.cardCost ? parseInt(card.cardCost) || null : null,
        power: card.cardPower ? parseInt(card.cardPower) || null : null,
        life: card.life ? parseInt(card.life) || null : null,
        counterPower: card.counterAmount ? parseInt(card.counterAmount) || null : null,
        traits: card.subTypes || null,
        effect: card.cardText || null,
        imageUrl: card.imageUrl || null,
        sources: ["optcgapi"],
        lastVerifiedAt: new Date(),
      }));

      try {
        await db.insert(cardCatalog).values(values).onConflictDoUpdate({
          target: cardCatalog.id,
          set: {
            name: sql`excluded.name`,
            setId: sql`excluded.set_id`,
            setName: sql`excluded.set_name`,
            cardType: sql`excluded.card_type`,
            color: sql`excluded.color`,
            rarity: sql`excluded.rarity`,
            cost: sql`excluded.cost`,
            power: sql`excluded.power`,
            life: sql`excluded.life`,
            counterPower: sql`excluded.counter_power`,
            traits: sql`excluded.traits`,
            effect: sql`excluded.effect`,
            imageUrl: sql`excluded.image_url`,
            lastVerifiedAt: sql`excluded.last_verified_at`,
            updatedAt: sql`now()`,
          },
        });
        stats.upserted += batch.length;
      } catch (e) {
        stats.errors.push(`Batch ${i}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
  } catch (e) {
    stats.errors.push(`Pipeline: ${e instanceof Error ? e.message : "unknown"}`);
  }

  return NextResponse.json({
    success: stats.errors.length === 0,
    stats,
    timestamp: new Date().toISOString(),
  });
}
