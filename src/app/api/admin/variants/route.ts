import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cardVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET — list variants for a card */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const variants = await db.select()
    .from(cardVariants)
    .where(eq(cardVariants.baseCardId, cardId));

  return NextResponse.json(variants);
}

/** POST — add a variant to a card */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { baseCardId, variantType, variantName, imageUrl, source, sourceUrl } = body;

  if (!baseCardId || !variantType) {
    return NextResponse.json({ error: "baseCardId and variantType required" }, { status: 400 });
  }

  const [variant] = await db.insert(cardVariants).values({
    baseCardId,
    variantType,
    variantName: variantName ?? null,
    imageUrl: imageUrl ?? null,
    source: source ?? "manual",
    sourceUrl: sourceUrl ?? null,
  }).returning();

  return NextResponse.json(variant, { status: 201 });
}

/** DELETE — remove a variant */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(cardVariants).where(eq(cardVariants.id, id));
  return NextResponse.json({ deleted: id });
}
