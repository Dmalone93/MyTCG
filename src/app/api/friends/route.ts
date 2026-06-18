import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { friendships, profiles } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";

/** GET /api/friends — list friends + pending requests */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all friendships involving this user
  const all = await db.select().from(friendships)
    .where(or(eq(friendships.userId, userId), eq(friendships.friendId, userId)));

  const friends = all.filter((f) => f.status === "accepted").map((f) => ({
    id: f.id,
    friendId: f.userId === userId ? f.friendId : f.userId,
    since: f.createdAt,
  }));

  const pendingReceived = all.filter((f) => f.status === "pending" && f.friendId === userId).map((f) => ({
    id: f.id,
    fromUserId: f.userId,
    createdAt: f.createdAt,
  }));

  const pendingSent = all.filter((f) => f.status === "pending" && f.userId === userId).map((f) => ({
    id: f.id,
    toUserId: f.friendId,
    createdAt: f.createdAt,
  }));

  // Get display names for all friend IDs
  const friendIds = [...new Set([
    ...friends.map((f) => f.friendId),
    ...pendingReceived.map((f) => f.fromUserId),
    ...pendingSent.map((f) => f.toUserId),
  ])];

  let nameMap = new Map<string, string>();
  if (friendIds.length > 0) {
    const profs = await db.select().from(profiles);
    nameMap = new Map(profs.map((p) => [p.id, p.displayName ?? "User"]));
  }

  return NextResponse.json({
    friends: friends.map((f) => ({ ...f, name: nameMap.get(f.friendId) ?? "User" })),
    pendingReceived: pendingReceived.map((f) => ({ ...f, name: nameMap.get(f.fromUserId) ?? "User" })),
    pendingSent: pendingSent.map((f) => ({ ...f, name: nameMap.get(f.toUserId) ?? "User" })),
  });
}

/** POST /api/friends — send friend request */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { friendId } = await request.json();
  if (!friendId || friendId === userId) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Check if already exists
  const existing = await db.select().from(friendships)
    .where(or(
      and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
      and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
    ));

  if (existing.length > 0) return NextResponse.json({ error: "Already exists" }, { status: 409 });

  const [row] = await db.insert(friendships).values({
    userId,
    friendId,
    status: "pending",
  }).returning();

  return NextResponse.json(row, { status: 201 });
}

/** PATCH /api/friends — accept/reject request */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = await request.json();
  if (!id || !["accept", "reject"].includes(action)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Verify this request is TO the current user
  const [req] = await db.select().from(friendships).where(eq(friendships.id, id));
  if (!req || req.friendId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "accept") {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, id));
  } else {
    await db.delete(friendships).where(eq(friendships.id, id));
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/friends — remove friend */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await db.delete(friendships).where(eq(friendships.id, id));
  return NextResponse.json({ success: true });
}
