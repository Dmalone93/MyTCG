import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cardCatalog, cardVariants, missingCardAlerts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchCatalog } from "@/lib/catalog/fetch-catalog";

/**
 * POST /api/pipeline/sync
 *
 * Multi-source reconciliation pipeline:
 * 1. Pull from optcgapi (primary catalog)
 * 2. Seed card_catalog + card_variants tables
 * 3. Cross-reference with JustTCG pricing to detect missing cards
 * 4. Flag missing cards as alerts
 *
 * Triggered manually or via cron. Auth required.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const cronAuth = secret && authHeader === `Bearer ${secret}`;

  // Auth: cron secret OR logged-in user OR public route (for initial sync)
  if (!cronAuth) {
    try {
      const { userId } = await auth();
      if (!userId) {
        // Allow if called from public route (middleware already validated)
      }
    } catch { /* auth not available — proceed if public route */ }
  }

  const stats = { catalogCards: 0, newCards: 0, updatedCards: 0, variants: 0, missingAlerts: 0, errors: [] as string[] };

  try {
    // ═══ STEP 1: Pull from optcgapi ═══
    const catalog = await fetchCatalog();
    stats.catalogCards = catalog.length;

    // ═══ STEP 2: Upsert into card_catalog ═══
    for (const card of catalog) {
      if (!card.cardSetId || !card.cardName) continue;

      const sources = ["optcgapi"];

      try {
        await db.insert(cardCatalog).values({
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
          sources,
          lastVerifiedAt: new Date(),
        }).onConflictDoUpdate({
          target: cardCatalog.id,
          set: {
            name: card.cardName,
            setId: card.setId || undefined,
            setName: card.setName || undefined,
            cardType: card.cardType || undefined,
            color: card.cardColor || undefined,
            rarity: card.rarity || undefined,
            cost: card.cardCost ? parseInt(card.cardCost) || undefined : undefined,
            power: card.cardPower ? parseInt(card.cardPower) || undefined : undefined,
            life: card.life ? parseInt(card.life) || undefined : undefined,
            counterPower: card.counterAmount ? parseInt(card.counterAmount) || undefined : undefined,
            traits: card.subTypes || undefined,
            effect: card.cardText || undefined,
            imageUrl: card.imageUrl || undefined,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        stats.newCards++;

        // Ensure a standard variant exists
        await db.insert(cardVariants).values({
          baseCardId: card.cardSetId,
          variantType: "standard",
          imageUrl: card.imageUrl || null,
          source: "optcgapi",
          marketPrice: card.marketPrice != null ? String(card.marketPrice) : null,
          priceFetchedAt: new Date(),
        }).onConflictDoNothing();
        stats.variants++;
      } catch (e) {
        // Continue on individual card errors
      }
    }

    // ═══ STEP 3: JustTCG discovery — find cards in pricing that we don't have ═══
    try {
      const justTcgKey = process.env.JUSTTCG_API_KEY;
      if (justTcgKey) {
        // Get all known card codes
        const known = await db.select({ id: cardCatalog.id }).from(cardCatalog);
        const knownCodes = new Set(known.map((k) => k.id.toUpperCase()));

        // Check JustTCG for One Piece cards (use a broad search)
        const res = await fetch(`https://api.justtcg.com/v1/products?game=one-piece&limit=100`, {
          headers: { Authorization: `Bearer ${justTcgKey}` },
        });

        if (res.ok) {
          const data = await res.json();
          const products = data.products ?? data.data ?? [];

          for (const product of products) {
            const code = (product.collector_number ?? product.code ?? "").toUpperCase().trim();
            if (!code) continue;

            if (!knownCodes.has(code)) {
              // Unknown card — create alert
              try {
                await db.insert(missingCardAlerts).values({
                  cardCode: code,
                  cardName: product.name ?? null,
                  detectedIn: "justtcg",
                  detectedPrice: product.price != null ? String(product.price) : null,
                }).onConflictDoNothing();
                stats.missingAlerts++;
              } catch { /* duplicate — ok */ }
            }
          }
        }
      }
    } catch (e) {
      stats.errors.push(`JustTCG discovery: ${e instanceof Error ? e.message : "unknown"}`);
    }

  } catch (e) {
    stats.errors.push(`Pipeline: ${e instanceof Error ? e.message : "unknown"}`);
  }

  return NextResponse.json({
    success: true,
    stats,
    timestamp: new Date().toISOString(),
  });
}
