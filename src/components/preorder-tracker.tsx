"use client";

import { useEffect, useState } from "react";

type Product = {
  name: string;
  setCode: string | null;
  releaseDate: string | null;
  retailers: Array<{ name: string; price: number; currency: string | null; url: string; inStock: boolean | null; isCheapest: boolean }>;
};

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function PreorderTracker() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/preorders")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.products) setProducts(d.products); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-text mb-3">Upcoming releases</div>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.name} className="bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-semibold text-text">{product.name}</div>
              {product.releaseDate && (
                <div className="text-sm text-text-dim flex-none ml-3">
                  <span className="font-semibold text-text">{daysUntil(product.releaseDate)} days</span>
                  <span className="ml-1">— {new Date(product.releaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {product.retailers.map((r) => (
                <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition-colors ${
                    r.isCheapest ? "border-[#059669] bg-[rgba(5,150,105,0.04)]" : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
                  }`}>
                  <span className="text-text-muted">{r.name}</span>
                  <span className="font-mono font-semibold text-text">{r.currency === "GBP" ? "£" : "€"}{r.price.toFixed(2)}</span>
                  {r.isCheapest && <span className="text-xs font-semibold text-[#059669]">Cheapest</span>}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
