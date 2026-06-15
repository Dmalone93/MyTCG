import { NextResponse } from "next/server";
import { fetchCatalog, searchCatalog } from "@/lib/catalog/fetch-catalog";

// Catalog is cached in server memory after first request
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 1) {
    return NextResponse.json([]);
  }

  const catalog = await fetchCatalog();
  const results = searchCatalog(catalog, q, 30);

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
