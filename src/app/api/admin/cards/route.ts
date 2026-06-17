import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cardCatalog, cardVariants, missingCardAlerts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET — list cards, search by code or name */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50") || 50, 200);

  let cards;
  if (q) {
    // Search by code or name (case-insensitive)
    cards = await db.select().from(cardCatalog).limit(limit);
    const qLower = q.toLowerCase();
    cards = cards.filter(
      (c) => c.id.toLowerCase().includes(qLower) || c.name.toLowerCase().includes(qLower)
    );
  } else {
    cards = await db.select().from(cardCatalog).limit(limit);
  }

  return NextResponse.json(cards);
}

/** POST — add a new card (manual admin) */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, setId, setName, cardType, color, rarity, cost, power, life, counterPower, traits, effect, imageUrl, variantType, variantName, variantImageUrl, baseCardId } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }

  // If this is a variant of an existing card
  if (baseCardId && variantType) {
    const [variant] = await db.insert(cardVariants).values({
      baseCardId,
      variantType,
      variantName: variantName ?? null,
      imageUrl: variantImageUrl ?? imageUrl ?? null,
      source: "manual",
    }).returning();

    // Resolve any missing card alert for this code
    await db.update(missingCardAlerts)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(eq(missingCardAlerts.cardCode, id));

    return NextResponse.json({ card: null, variant }, { status: 201 });
  }

  // Insert base card
  const [card] = await db.insert(cardCatalog).values({
    id,
    name,
    setId: setId ?? null,
    setName: setName ?? null,
    cardType: cardType ?? null,
    color: color ?? null,
    rarity: rarity ?? null,
    cost: cost != null ? Number(cost) : null,
    power: power != null ? Number(power) : null,
    life: life != null ? Number(life) : null,
    counterPower: counterPower != null ? Number(counterPower) : null,
    traits: traits ?? null,
    effect: effect ?? null,
    imageUrl: imageUrl ?? null,
    sources: ["manual"],
  }).onConflictDoUpdate({
    target: cardCatalog.id,
    set: {
      name,
      setId: setId ?? undefined,
      setName: setName ?? undefined,
      cardType: cardType ?? undefined,
      color: color ?? undefined,
      rarity: rarity ?? undefined,
      cost: cost != null ? Number(cost) : undefined,
      power: power != null ? Number(power) : undefined,
      life: life != null ? Number(life) : undefined,
      counterPower: counterPower != null ? Number(counterPower) : undefined,
      traits: traits ?? undefined,
      effect: effect ?? undefined,
      imageUrl: imageUrl ?? undefined,
      updatedAt: new Date(),
    },
  }).returning();

  // Also add standard variant
  await db.insert(cardVariants).values({
    baseCardId: id,
    variantType: "standard",
    variantName: null,
    imageUrl: imageUrl ?? null,
    source: "manual",
  }).onConflictDoNothing();

  // Resolve any missing card alert
  await db.update(missingCardAlerts)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(missingCardAlerts.cardCode, id));

  return NextResponse.json({ card, variant: null }, { status: 201 });
}

/** DELETE — remove a card */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(cardCatalog).where(eq(cardCatalog.id, id));
  return NextResponse.json({ deleted: id });
}
