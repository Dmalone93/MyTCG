"use client";

import { useEffect, useState } from "react";

type ExtData = {
  card: {
    cid: string;
    name: string;
    type: string;
    color: string;
    cost: number | null;
    power: number | null;
    life: number | null;
    rarity: string;
    traits: string;
    effect: string;
    altArt: string | null;
    setName: string;
    counterPower: number | null;
  };
  synergies: Array<{ cid: string; name: string; imageUrl: string }>;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export function CardDataSheet({
  cardCode,
  cardName,
  imageUrl,
  marketPrice,
  onClose,
}: {
  cardCode: string;
  cardName: string;
  imageUrl: string;
  marketPrice?: number | null;
  onClose: () => void;
}) {
  const [ext, setExt] = useState<ExtData | null>(null);

  useEffect(() => {
    fetch(`/api/card-info?code=${encodeURIComponent(cardCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setExt(data); })
      .catch(() => {});
  }, [cardCode]);

  const c = ext?.card;

  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Name", value: c?.name ?? cardName },
    { label: "Card ID", value: c?.cid ?? cardCode },
    { label: "Type", value: c?.traits },
    { label: "Card Category", value: c?.type },
    { label: "Effect", value: c?.effect },
    { label: "Product", value: c?.setName },
    { label: "Color", value: c?.color },
    { label: "Rarity", value: c?.rarity },
    { label: "Cost", value: c?.cost != null ? String(c.cost) : null },
    { label: "Power", value: c?.power != null ? String(c.power) : null },
    { label: "Counter Power", value: c?.counterPower != null ? String(c.counterPower) : null },
    { label: "Life", value: c?.life != null ? String(c.life) : null },
    { label: "Alternate Art", value: c?.altArt },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="font-semibold text-base sm:text-lg text-text truncate">{cardName}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none">×</button>
        </div>

        {/* Content — image + table side by side on desktop, stacked on mobile */}
        <div className="flex flex-col sm:flex-row">
          {/* Card image */}
          <div className="sm:w-[240px] flex-none p-4 sm:p-5 flex justify-center sm:justify-start">
            <img
              src={imageUrl}
              alt={cardName}
              className="w-[160px] sm:w-full rounded-lg aspect-[2.5/3.5] object-cover"
            />
          </div>

          {/* Data table */}
          <div className="flex-1 min-w-0 sm:border-l border-[rgba(0,0,0,0.04)]">
            {/* Market price banner */}
            {marketPrice != null && marketPrice > 0 && (
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.02)]">
                <span className="text-sm text-text-dim">Market Price</span>
                <span className="font-mono text-lg font-semibold text-[#059669]">{fmt(marketPrice)}</span>
              </div>
            )}

            {/* Property rows */}
            <div>
              {rows.map((row) => {
                if (!row.value) return null;
                const isEffect = row.label === "Effect";
                return (
                  <div
                    key={row.label}
                    className="flex border-b border-[rgba(0,0,0,0.04)] last:border-0"
                  >
                    <div className="w-[120px] sm:w-[140px] flex-none px-4 sm:px-5 py-2.5 text-sm text-text-dim">
                      {row.label}
                    </div>
                    <div className={`flex-1 px-4 sm:px-5 py-2.5 text-sm text-text ${isEffect ? "whitespace-pre-line leading-relaxed" : "text-right"}`}>
                      {row.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Loading state */}
            {!ext && (
              <div className="px-4 py-6 text-center text-text-dim text-xs animate-pulse">
                Loading card data...
              </div>
            )}
          </div>
        </div>

        {/* Synergies */}
        {ext && ext.synergies.length > 0 && (
          <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-4">
            <div className="text-sm font-medium text-text-dim mb-2">Synergies</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ext.synergies.map((s) => (
                <div key={s.cid} className="flex-none w-[60px]">
                  <div className="aspect-[2.5/3.5] rounded overflow-hidden bg-[#E4E4E7] mb-1">
                    <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="text-[9px] text-text-dim truncate">{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
