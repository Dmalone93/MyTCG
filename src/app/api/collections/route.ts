import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collections, collectionCards } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json([], { status: 401 });

  const cols = await db
    .select({
      id: collections.id,
      name: collections.name,
      cardCount: sql<number>`(SELECT COUNT(*) FROM collection_cards WHERE collection_id = ${collections.id})`,
    })
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(collections.sortOrder, collections.createdAt);

  return NextResponse.json(cols);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await request.json();

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId));

  const [row] = await db
    .insert(collections)
    .values({ userId, name: name ?? "New Collection", sortOrder: existing.length })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name } = await request.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: "Missing id or name" }, { status: 400 });

  await db
    .update(collections)
    .set({ name: name.trim() })
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Delete cards first (cascade should handle this but being explicit)
  await db.delete(collectionCards).where(eq(collectionCards.collectionId, id));
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, userId)));

  return NextResponse.json({ success: true });
}
