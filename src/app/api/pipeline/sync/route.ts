import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cardCatalog, cardVariants } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const cronAuth = secret && authHeader === `Bearer ${secret}`;

  if (!cronAuth) {
    try { const { userId } = await auth(); } catch { /* proceed */ }
  }

  const stats = { catalogCards: 0, baseCards: 0, variants: 0, errors: [] as string[] };

  try {
    const catalog = await fetchCatalog();
    stats.catalogCards = catalog.length;

    // Group all entries by cardSetId — first entry is base, rest are variants
    const grouped = new Map<string, typeof catalog>();
    for (const card of catalog) {
      if (!card.cardSetId || !card.cardName) continue;
      const existing = grouped.get(card.cardSetId) ?? [];
      existing.push(card);
      grouped.set(card.cardSetId, existing);
    }

    // Batch upsert base cards (first entry per code)
    const BATCH_SIZE = 20;
    const baseCards = [...grouped.entries()].map(([code, entries]) => entries[0]);

    for (let i = 0; i < baseCards.length; i += BATCH_SIZE) {
      const batch = baseCards.slice(i, i + BATCH_SIZE);
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
        stats.baseCards += batch.length;
      } catch (e) {
        stats.errors.push(`Base batch ${i}: ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`);
      }
    }

    // Batch insert ALL entries as variants
    const allVariants: Array<{
      baseCardId: string; variantType: string; variantName: string | null;
      imageUrl: string | null; marketPrice: string | null; currency: string;
      priceFetchedAt: Date; source: string;
    }> = [];

    for (const [code, entries] of grouped) {
      for (let vi = 0; vi < entries.length; vi++) {
        const card = entries[vi];
        const nameLower = card.cardName.toLowerCase();
        let variantType = "standard";
        if (nameLower.includes("alternate art") || nameLower.includes("alt art")) variantType = "alt-art";
        else if (nameLower.includes("manga")) variantType = "manga-art";
        else if (nameLower.includes("(sp)") || nameLower.includes("special")) variantType = "parallel";
        else if (nameLower.includes("promo")) variantType = "promo-stamped";
        else if (nameLower.includes("parallel")) variantType = "parallel";
        else if (vi > 0) variantType = "alt-art";

        allVariants.push({
          baseCardId: code,
          variantType,
          variantName: card.cardName,
          imageUrl: card.imageUrl || null,
          marketPrice: card.marketPrice != null ? String(card.marketPrice) : null,
          currency: "GBP",
          priceFetchedAt: new Date(),
          source: "optcgapi",
        });
      }
    }

    // Batch insert variants in chunks of 20
    for (let i = 0; i < allVariants.length; i += BATCH_SIZE) {
      const batch = allVariants.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(cardVariants).values(batch).onConflictDoNothing();
        stats.variants += batch.length;
      } catch (e) {
        stats.errors.push(`Variant batch ${i}: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
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
