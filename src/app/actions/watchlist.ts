"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { watchlist, cardPrices } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function getWatchlist(userId: string) {
  const { userId: authedUserId } = await auth();
  if (!authedUserId || authedUserId !== userId) throw new Error("Unauthorized");

  const items = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(watchlist.createdAt);

  // Fetch current prices for all watched cards
  const cardCodes = items.map((i) => i.cardCode);
  const prices =
    cardCodes.length > 0
      ? await db
          .select()
          .from(cardPrices)
          .where(inArray(cardPrices.cardCode, cardCodes))
      : [];

  const priceMap = new Map(prices.map((p) => [p.cardCode, p]));

  return items.map((item) => ({
    ...item,
    currentPrice: priceMap.get(item.cardCode)?.rawMarket ?? null,
    priceFetchedAt: priceMap.get(item.cardCode)?.fetchedAt ?? null,
  }));
}

export async function addToWatchlist(card: {
  cardCode: string;
  cardName: string;
  imageUrl?: string | null;
  targetPrice?: string | null;
  notes?: string | null;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .insert(watchlist)
    .values({
      userId,
      cardCode: card.cardCode,
      cardName: card.cardName,
      imageUrl: card.imageUrl ?? null,
      targetPrice: card.targetPrice ?? null,
      notes: card.notes ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return row ?? null;
}

export async function removeFromWatchlist(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
}

export async function updateWatchlistItem(
  id: string,
  updates: Partial<{
    targetPrice: string | null;
    notes: string | null;
  }>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .update(watchlist)
    .set(updates)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning();
  return row;
}
