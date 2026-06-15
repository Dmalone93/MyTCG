import { NextResponse } from "next/server";
import { getExtendedCards } from "@/lib/catalog/extended-cards";

function extractCode(text: string): string {
  const up = text.toUpperCase().replace(/[^A-Z0-9-]/g, " ");
  let m = up.match(/(OP|ST|EB|PRB)\s*[O0]?(\d{1,2})\s*[-\s.]\s*([\dO]{2,3})/);
  if (m) {
    return (
      m[1] +
      m[2].replace(/O/g, "0").padStart(2, "0") +
      "-" +
      m[3].replace(/O/g, "0").padStart(3, "0")
    );
  }
  m = up.match(/(OP|ST|EB)\s*(\d{2})\s*(\d{3})/);
  if (m) return m[1] + m[2] + "-" + m[3];
  m = up.match(/P\s*[-\s.]\s*([\dO]{3})/);
  if (m) return "P-" + m[1].replace(/O/g, "0");
  return "";
}

function extractAllCodes(text: string): string[] {
  const codes: string[] = [];
  const up = text.toUpperCase();
  const re = /(OP|ST|EB|PRB)\s*[O0]?(\d{1,2})\s*[-\s.]\s*(\d{2,3})/g;
  let m;
  while ((m = re.exec(up)) !== null) {
    codes.push(m[1] + m[2].padStart(2, "0") + "-" + m[3].padStart(3, "0"));
  }
  return [...new Set(codes)];
}

function extractCodesFromWeb(
  webDetection: Record<string, unknown> | undefined
): string[] {
  if (!webDetection) return [];
  const codes: string[] = [];
  const urls: string[] = [];

  const collect = (arr: Array<Record<string, string>> | undefined) => {
    if (!arr) return;
    arr.forEach((item) => {
      if (item.url) urls.push(item.url);
      if (item.pageTitle) urls.push(item.pageTitle);
      if (item.description) urls.push(item.description);
      if (item.label) urls.push(item.label);
    });
  };

  collect(webDetection.fullMatchingImages as Array<Record<string, string>>);
  collect(webDetection.partialMatchingImages as Array<Record<string, string>>);
  collect(webDetection.pagesWithMatchingImages as Array<Record<string, string>>);
  collect(webDetection.webEntities as Array<Record<string, string>>);
  collect(webDetection.bestGuessLabels as Array<Record<string, string>>);

  for (const s of urls) {
    const up = s.toUpperCase();
    const re = /(OP|ST|EB|PRB)\s*-?\s*(\d{1,2})\s*-?\s*(\d{2,3})/g;
    let m;
    while ((m = re.exec(up)) !== null) {
      codes.push(m[1] + m[2].padStart(2, "0") + "-" + m[3].padStart(3, "0"));
    }
    const pre = /P\s*-\s*(\d{3})/g;
    while ((m = pre.exec(up)) !== null) codes.push("P-" + m[1]);
  }

  return [...new Set(codes)];
}

function extractCardName(text: string, webLabels: string[]): string | null {
  const extCards = getExtendedCards();
  const textLower = text.toLowerCase();

  // First: try to match a known card name from the extended database
  // Sort by name length descending to match longer names first
  const nameMatches = extCards
    .filter((c) => c.name.length > 3 && textLower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);

  if (nameMatches.length > 0) {
    return nameMatches[0].name;
  }

  // Second: check web labels against known card names
  for (const label of webLabels) {
    const labelLower = label.toLowerCase();
    const match = extCards.find((c) =>
      c.name.length > 3 && labelLower.includes(c.name.toLowerCase())
    );
    if (match) return match.name;
  }

  // Third: fall back to OCR text line analysis
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^[A-Z0-9-]{2,10}$/.test(line)) continue;
    if (line.length < 3 || line.length > 50) continue;
    if (/^(COUNTER|BLOCKER|RUSH|TRIGGER|COST|POWER|DON|ONE PIECE)/i.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 5 && /[A-Za-z]/.test(line)) {
      return line;
    }
  }

  // Fourth: web labels that look like character names
  for (const label of webLabels) {
    if (label.length > 3 && label.length < 40 && !/^(one piece|tcg|card|trading)/i.test(label)) {
      return label;
    }
  }

  return null;
}

function extractRarity(text: string): string | null {
  const up = text.toUpperCase();
  if (up.includes("SECRET") || /\bSEC\b/.test(up)) return "SEC";
  if (/\bSR\b/.test(up) || up.includes("SUPER RARE")) return "SR";
  if (/\bSP\b/.test(up) || up.includes("SPECIAL")) return "SP";
  if (up.includes("UNCOMMON") || /\bUC\b/.test(up)) return "UC";
  if (up.includes("COMMON") && !up.includes("UNCOMMON")) return "C";
  if (/\bR\b/.test(up) && up.includes("RARE") && !up.includes("SUPER")) return "R";
  if (/\bL\b/.test(up) || up.includes("LEADER")) return "L";
  return null;
}

function extractColor(text: string, labels: string[]): string | null {
  const all = (text + " " + labels.join(" ")).toUpperCase();
  const colors = ["RED", "BLUE", "GREEN", "PURPLE", "BLACK", "YELLOW"];
  for (const c of colors) {
    if (all.includes(c)) return c;
  }
  return null;
}

export async function POST(request: Request) {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Vision API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const base64 = body.image as string;
  if (!base64) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [
                { type: "DOCUMENT_TEXT_DETECTION", maxResults: 10 },
                { type: "WEB_DETECTION", maxResults: 10 },
                { type: "LABEL_DETECTION", maxResults: 10 },
              ],
              imageContext: { languageHints: ["en", "ja"] },
            },
          ],
        }),
      }
    );

    const data = await res.json();
    if (data.error) {
      return NextResponse.json(
        { error: data.error.message },
        { status: 400 }
      );
    }

    const resp = data.responses?.[0] ?? {};

    // Extract text
    const text =
      resp.textAnnotations?.[0]?.description ?? "";

    // Try text-based codes first
    let codes = extractAllCodes(text);

    // Fall back to web detection
    if (codes.length === 0) {
      codes = extractCodesFromWeb(resp.webDetection);
    }

    // Single code extraction as fallback
    if (codes.length === 0) {
      const single = extractCode(text);
      if (single) codes = [single];
    }

    // Best guess label from web detection
    const bestGuess =
      resp.webDetection?.bestGuessLabels?.[0]?.label ?? null;

    // Labels from label detection
    const labels: string[] = (resp.labelAnnotations ?? [])
      .map((l: Record<string, unknown>) => String(l.description ?? ""))
      .filter(Boolean);

    // Web entities
    const webEntities: string[] = (resp.webDetection?.webEntities ?? [])
      .map((e: Record<string, unknown>) => String(e.description ?? ""))
      .filter(Boolean);

    // Try to extract card name from OCR text
    const cardName = extractCardName(text, [...webEntities, ...labels]);

    // Try to detect rarity from text
    const rarity = extractRarity(text);

    // Try to detect color from text/labels
    const color = extractColor(text, labels);

    return NextResponse.json({
      codes,
      text: text.slice(0, 300),
      bestGuess,
      labels: [...webEntities, ...labels].slice(0, 15),
      cardName,
      rarity,
      color,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vision API error" },
      { status: 500 }
    );
  }
}
