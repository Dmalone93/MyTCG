import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { missingCardAlerts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/** GET — list unresolved missing card alerts */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await db.select()
    .from(missingCardAlerts)
    .where(eq(missingCardAlerts.resolved, false))
    .orderBy(desc(missingCardAlerts.createdAt))
    .limit(100);

  return NextResponse.json(alerts);
}

/** PATCH — resolve an alert (mark as handled) */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.update(missingCardAlerts)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(missingCardAlerts.id, id));

  return NextResponse.json({ resolved: id });
}
