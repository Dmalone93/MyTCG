import { NextResponse } from "next/server";
import { findExtended, findSynergies } from "@/lib/catalog/extended-cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const card = findExtended(code);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const synergies = findSynergies(card, 6).map((s) => ({
    cid: s.cid,
    name: s.name,
    color: s.color,
    rarity: s.rarity,
    imageUrl: s.imageUrl,
    traits: s.traits,
  }));

  return NextResponse.json({
    card: {
      cid: card.cid,
      name: card.name,
      type: card.type,
      color: card.color,
      cost: card.cost,
      power: card.power,
      life: card.life,
      rarity: card.rarity,
      traits: card.traits,
      effect: card.effect,
      altArt: card.altArt,
      imageUrl: card.imageUrl,
      setName: card.setName,
      counterPower: card.counterPower,
    },
    synergies,
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
