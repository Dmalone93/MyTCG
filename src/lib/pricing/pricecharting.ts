import type { PriceProvider, PriceResult, SearchResult } from "./provider";

const API_BASE = "https://www.pricecharting.com/api";

function getApiKey(): string {
  const key = process.env.PRICECHARTING_API_KEY;
  if (!key) {
    throw new Error("PRICECHARTING_API_KEY is not set");
  }
  return key;
}

async function apiFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("t", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`PriceCharting API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export class PriceChartingProvider implements PriceProvider {
  async getPrice(cardCode: string): Promise<PriceResult | null> {
    try {
      // PriceCharting uses product search — search by card code to find the product
      const results = await apiFetch("products", { q: cardCode });

      // The API returns a product or list; pick the best match
      const product = Array.isArray(results)
        ? results[0]
        : results?.products?.[0] ?? results;

      if (!product || !product["id"]) return null;

      // Fetch full product details for graded prices
      const detail = await apiFetch("product", {
        id: String(product["id"]),
      });

      const gradedPrices: Record<string, number> = {};

      // PriceCharting provides graded prices in cents
      if (detail["graded-price"]) {
        gradedPrices["Graded"] = detail["graded-price"] / 100;
      }
      if (detail["psa-10-price"]) {
        gradedPrices["PSA 10"] = detail["psa-10-price"] / 100;
      }
      if (detail["psa-9-price"]) {
        gradedPrices["PSA 9"] = detail["psa-9-price"] / 100;
      }
      if (detail["psa-8-price"]) {
        gradedPrices["PSA 8"] = detail["psa-8-price"] / 100;
      }
      if (detail["bgs-10-price"]) {
        gradedPrices["BGS 10"] = detail["bgs-10-price"] / 100;
      }
      if (detail["bgs-9.5-price"]) {
        gradedPrices["BGS 9.5"] = detail["bgs-9.5-price"] / 100;
      }
      if (detail["cgc-10-price"]) {
        gradedPrices["CGC 10"] = detail["cgc-10-price"] / 100;
      }
      if (detail["cgc-9.5-price"]) {
        gradedPrices["CGC 9.5"] = detail["cgc-9.5-price"] / 100;
      }

      // raw/ungraded price in cents
      const rawMarket = detail["price"]
        ? detail["price"] / 100
        : detail["loose-price"]
        ? detail["loose-price"] / 100
        : null;

      return {
        cardCode,
        rawMarket,
        gradedPrices,
        currency: "USD",
      };
    } catch (err) {
      console.error(`PriceCharting getPrice failed for ${cardCode}:`, err);
      return null;
    }
  }

  async getGradedPrices(
    cardCode: string
  ): Promise<Record<string, number> | null> {
    const result = await this.getPrice(cardCode);
    return result?.gradedPrices ?? null;
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const data = await apiFetch("products", { q: query });
      const products = Array.isArray(data)
        ? data
        : data?.products ?? [];

      return products.slice(0, 20).map(
        (p: Record<string, unknown>) => ({
          id: String(p["id"]),
          name: String(p["product-name"] ?? p["name"] ?? ""),
          cardCode: String(
            p["console-name"] ?? p["upc"] ?? p["id"] ?? ""
          ),
          imageUrl: p["image-url"] ? String(p["image-url"]) : undefined,
        })
      );
    } catch (err) {
      console.error("PriceCharting search failed:", err);
      return [];
    }
  }
}
