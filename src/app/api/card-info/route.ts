import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardCatalog } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { findExtended, findSynergies } from "@/lib/catalog/extended-cards";

/**
 * GET /api/card-info?code=OP01-047
 * Returns card data from card_catalog DB, with synergies from extended data.
 * Falls back to extended JSON for synergies (which have trait/color matching).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Try DB first
  const [dbCard] = await db.select().from(cardCatalog).where(eq(cardCatalog.id, code)).limit(1);

  // Try normalized code if not found
  let card = dbCard;
  if (!card) {
    const normalized = code.toUpperCase().replace(/\s+/g, "");
    const [alt] = await db.select().from(cardCatalog).where(eq(cardCatalog.id, normalized)).limit(1);
    card = alt;
  }

  if (!card) {
    // Fall back to extended JSON
    const ext = findExtended(code);
    if (!ext) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const synergies = findSynergies(ext, 6).map((s) => ({
      cid: s.cid, name: s.name, color: s.color, rarity: s.rarity,
      imageUrl: s.imageUrl, traits: s.traits,
    }));

    return NextResponse.json({
      card: {
        cid: ext.cid, name: ext.name, type: ext.type, color: ext.color,
        cost: ext.cost, power: ext.power, life: ext.life, rarity: ext.rarity,
        traits: ext.traits, effect: ext.effect, altArt: ext.altArt,
        imageUrl: ext.imageUrl, setName: ext.setName, counterPower: ext.counterPower,
      },
      synergies,
    }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  // Build response from DB card
  const cardData = {
    cid: card.id,
    name: card.name,
    type: card.cardType ?? "",
    color: card.color ?? "",
    cost: card.cost,
    power: card.power,
    life: card.life,
    rarity: card.rarity ?? "",
    traits: card.traits ?? "",
    effect: card.effect ?? "",
    altArt: null as string | null,
    imageUrl: card.imageUrl ?? "",
    setName: card.setName ?? "",
    counterPower: card.counterPower,
  };

  // Get synergies — try extended JSON first (has trait matching), then DB fallback
  let synergies: Array<{ cid: string; name: string; imageUrl: string }> = [];
  const ext = findExtended(code);
  if (ext) {
    synergies = findSynergies(ext, 6).map((s) => ({
      cid: s.cid, name: s.name, imageUrl: s.imageUrl,
    }));
    if (ext.altArt) cardData.altArt = ext.altArt;
  }

  // If no synergies from extended, try DB — same color + type cards
  if (synergies.length === 0 && card.color) {
    const similar = await db.select({
      id: cardCatalog.id,
      name: cardCatalog.name,
      imageUrl: cardCatalog.imageUrl,
    })
      .from(cardCatalog)
      .where(
        and(
          sql`${cardCatalog.color} LIKE ${'%' + card.color.split('/')[0] + '%'}`,
          sql`${cardCatalog.id} != ${card.id}`,
          sql`${cardCatalog.cardType} != 'Leader'`
        )
      )
      .limit(6);

    synergies = similar.map((s) => ({
      cid: s.id,
      name: s.name,
      imageUrl: s.imageUrl ?? "",
    }));
  }

  return NextResponse.json({ card: cardData, synergies }, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
