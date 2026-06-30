"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collections, collectionCards, cardPrices, activityFeed } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function getCollections() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(collections.sortOrder, collections.createdAt);
}

export async function createCollection(name: string, sortOrder: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .insert(collections)
    .values({ userId, name, sortOrder })
    .returning();

  // Record activity
  try {
    await db.insert(activityFeed).values({
      userId,
      action: "created_collection",
      collectionName: name,
    });
  } catch { /* */ }

  return row;
}

export async function renameCollection(id: string, name: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(collections)
    .set({ name })
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

export async function deleteCollection(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

export async function reorderCollections(
  items: { id: string; sortOrder: number }[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  for (const item of items) {
    await db
      .update(collections)
      .set({ sortOrder: item.sortOrder })
      .where(and(eq(collections.id, item.id), eq(collections.userId, userId)));
  }
}

export async function getCards(collectionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.collectionId, collectionId),
        eq(collectionCards.userId, userId)
      )
    )
    .orderBy(collectionCards.createdAt);
}

export async function getPrices(cardCodes: string[]) {
  if (cardCodes.length === 0) return [];
  return db
    .select()
    .from(cardPrices)
    .where(inArray(cardPrices.cardCode, cardCodes));
}

export async function addCard(data: {
  collectionId: string;
  cardCode: string;
  cardName: string;
  quantity: number;
  condition: string | null;
  isGraded: boolean;
  grade: string | null;
  gradedCompany: string | null;
  acquiredPrice: string | null;
  notes: string | null;
  imageUrl: string | null;
  marketPrice?: number | null;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .insert(collectionCards)
    .values({
      collectionId: data.collectionId,
      userId,
      cardCode: data.cardCode,
      cardName: data.cardName,
      quantity: data.quantity,
      condition: data.condition,
      isGraded: data.isGraded,
      grade: data.grade,
      gradedCompany: data.gradedCompany,
      acquiredPrice: data.acquiredPrice,
      notes: data.notes,
      imageUrl: data.imageUrl,
    })
    .returning();

  // Record activity
  try {
    const [col] = await db.select({ name: collections.name }).from(collections).where(eq(collections.id, data.collectionId)).limit(1);
    await db.insert(activityFeed).values({
      userId,
      action: "added_card",
      cardCode: data.cardCode,
      cardName: data.cardName,
      cardImageUrl: data.imageUrl,
      collectionName: col?.name ?? null,
    });
  } catch { /* activity logging should never block card add */ }

  // Cache the market price from the catalog if provided
  if (data.marketPrice != null && data.marketPrice > 0) {
    await db
      .insert(cardPrices)
      .values({
        cardCode: data.cardCode,
        rawMarket: String(data.marketPrice),
        gradedPrices: null,
        currency: "EUR",
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cardPrices.cardCode,
        set: {
          rawMarket: String(data.marketPrice),
          fetchedAt: new Date(),
        },
      });
  }

  return row;
}

export async function updateCard(
  id: string,
  updates: Partial<{
    quantity: number;
    condition: string | null;
    isGraded: boolean;
    grade: string | null;
    gradedCompany: string | null;
    acquiredPrice: string | null;
    notes: string | null;
  }>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .update(collectionCards)
    .set(updates)
    .where(
      and(eq(collectionCards.id, id), eq(collectionCards.userId, userId))
    )
    .returning();
  return row;
}

export async function deleteCard(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(collectionCards)
    .where(
      and(eq(collectionCards.id, id), eq(collectionCards.userId, userId))
    );
}

export async function moveCard(id: string, targetCollectionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(collectionCards)
    .set({ collectionId: targetCollectionId })
    .where(
      and(eq(collectionCards.id, id), eq(collectionCards.userId, userId))
    );
}
