import { NextResponse } from "next/server";

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
                { type: "WEB_DETECTION", maxResults: 5 },
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

    return NextResponse.json({
      codes,
      text: text.slice(0, 200),
      bestGuess,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vision API error" },
      { status: 500 }
    );
  }
}
