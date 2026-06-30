import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { activityFeed, friendships, profiles } from "@/lib/db/schema";
import { eq, or, and, desc, inArray } from "drizzle-orm";

/** GET /api/activity — get activity feed (own + friends) */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20") || 20, 50);

  // Get accepted friends
  const allFriendships = await db.select().from(friendships)
    .where(and(
      or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
      eq(friendships.status, "accepted")
    ));

  const friendIds = allFriendships.map((f) => f.userId === userId ? f.friendId : f.userId);
  const allUserIds = [userId, ...friendIds];

  // Get activity for all
  const activity = await db.select().from(activityFeed)
    .where(inArray(activityFeed.userId, allUserIds))
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit);

  // Get display names
  const profs = await db.select().from(profiles);
  const nameMap = new Map(profs.map((p) => [p.id, p.displayName ?? "User"]));

  const items = activity.map((a) => ({
    ...a,
    userName: nameMap.get(a.userId) ?? "User",
    isOwn: a.userId === userId,
  }));

  return NextResponse.json(items);
}

/** POST /api/activity — record an activity */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action, cardCode, cardName, cardImageUrl, collectionName, metadata } = body;

  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const [row] = await db.insert(activityFeed).values({
    userId,
    action,
    cardCode: cardCode ?? null,
    cardName: cardName ?? null,
    cardImageUrl: cardImageUrl ?? null,
    collectionName: collectionName ?? null,
    metadata: metadata ?? null,
  }).returning();

  return NextResponse.json(row, { status: 201 });
}
