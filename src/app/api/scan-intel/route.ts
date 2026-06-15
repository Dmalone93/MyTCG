import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { intelItems } from "@/lib/db/schema";

const CATEGORIES = [
  {
    key: "tcg_japan",
    query: "One Piece TCG Japan new card set release 2026 site:reddit.com OR site:twitter.com OR site:onepiece-cardgame.com",
  },
  {
    key: "tcg_english",
    query: "One Piece TCG English booster pack release date 2026 new set announcement",
  },
  {
    key: "sec_alt_arts",
    query: "One Piece TCG secret rare alt art reveal new card 2026 SEC manga art",
  },
  {
    key: "anime_manga",
    query: "One Piece anime manga chapter episode 2026 new arc announcement",
  },
  {
    key: "prices",
    query: "One Piece TCG card price spike market value increase 2026 most expensive",
  },
];

type IntelResult = {
  category: string;
  title: string;
  summary: string;
  source: string;
  published: string;
  urgent: boolean;
  jp_only: boolean;
  card_names: string[];
};

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const allResults: IntelResult[] = [];
  const errors: string[] = [];

  for (const cat of CATEGORIES) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{
          role: "user",
          content: `Search the web for the latest news about: ${cat.query}\n\nReturn ONLY a JSON array of news items (max 5). Each item must have these fields:\n- "title": string\n- "summary": string (2-3 sentences)\n- "source": string (URL or domain)\n- "published": string (date or "recent")\n- "urgent": boolean\n- "jp_only": boolean\n- "card_names": string[]\n\nReturn ONLY the JSON array, no other text.`,
        }],
      });

      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const items: IntelResult[] = JSON.parse(jsonMatch[0]).map(
          (item: Record<string, unknown>) => ({
            category: cat.key,
            title: String(item.title ?? "").slice(0, 500),
            summary: String(item.summary ?? "").slice(0, 2000),
            source: String(item.source ?? ""),
            published: String(item.published ?? ""),
            urgent: Boolean(item.urgent),
            jp_only: Boolean(item.jp_only),
            card_names: Array.isArray(item.card_names) ? item.card_names.map(String) : [],
          })
        );
        allResults.push(...items);
      }
    } catch (err) {
      errors.push(`${cat.key}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  let inserted = 0;
  const seen = new Set<string>();

  for (const item of allResults) {
    if (!item.title || seen.has(item.title)) continue;
    seen.add(item.title);

    try {
      await db
        .insert(intelItems)
        .values({
          category: item.category,
          title: item.title,
          summary: item.summary,
          source: item.source,
          published: item.published,
          urgent: item.urgent,
          jpOnly: item.jp_only,
          cardNames: item.card_names,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: intelItems.title,
          set: {
            summary: item.summary,
            source: item.source,
            published: item.published,
            urgent: item.urgent,
            jpOnly: item.jp_only,
            cardNames: item.card_names,
            fetchedAt: new Date(),
          },
        });
      inserted++;
    } catch {
      // duplicate or other error — skip
    }
  }

  return NextResponse.json({
    message: `Scanned ${CATEGORIES.length} categories, inserted/updated ${inserted} items`,
    inserted,
    total: allResults.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
