"use client";

import { useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

type NewCard = {
  cardCode: string;
  cardName: string;
  quantity: number;
  condition: string | null;
  isGraded: boolean;
  grade: string | null;
  gradedCompany: string | null;
  acquiredPrice: string | null;
  notes: string | null;
  imageUrl: string | null;
  marketPrice?: number | null;
};

export function AddCardForm({
  prefill,
  onSubmit,
  onCancel,
}: {
  prefill?: CatalogCard;
  onSubmit: (card: NewCard) => Promise<void>;
  onCancel: () => void;
}) {
  const [cardCode, setCardCode] = useState(prefill?.cardSetId ?? "");
  const [cardName, setCardName] = useState(prefill?.cardName ?? "");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("NM");
  const [acquiredPrice, setAcquiredPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardCode.trim() || !cardName.trim()) return;
    setLoading(true);
    await onSubmit({
      cardCode: cardCode.trim().toUpperCase(),
      cardName: cardName.trim(),
      quantity,
      condition,
      isGraded: false,
      grade: null,
      gradedCompany: null,
      acquiredPrice: acquiredPrice || null,
      notes: null,
      imageUrl: prefill?.imageUrl ?? null,
      marketPrice: prefill?.marketPrice ?? null,
    });
    setLoading(false);
  }

  const inputClass =
    "bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-sm text-text focus:outline-2 focus:outline-accent";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mb-3 space-y-3"
    >
      {/* Card preview from catalog */}
      {prefill && (
        <div className="flex items-center gap-3 pb-2 border-b border-[rgba(255,255,255,0.04)]">
          <div className="relative w-10 h-14 flex-none rounded-lg overflow-hidden bg-[#1C1C1F]">
            <img
              src={prefill.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-text truncate">
              {prefill.cardName}
            </div>
            <div className="text-xs text-text-dim">
              {prefill.cardSetId} · {prefill.setName} · {prefill.rarity}
            </div>
            {prefill.marketPrice != null && prefill.marketPrice > 0 && (
              <div className="font-mono text-xs text-[#4ADE80] mt-0.5">
                Market: €{prefill.marketPrice.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
            Card code
          </label>
          <input
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value)}
            placeholder="OP13-001"
            required
            className={inputClass + " w-full"}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
            Card name
          </label>
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="Monkey D. Luffy"
            required
            className={inputClass + " w-full"}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
            Qty
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className={inputClass + " w-full"}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className={inputClass + " w-full"}
          >
            <option value="NM">NM</option>
            <option value="LP">LP</option>
            <option value="MP">MP</option>
            <option value="HP">HP</option>
            <option value="DMG">DMG</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
            Price paid
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={acquiredPrice}
            onChange={(e) => setAcquiredPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass + " w-full"}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-accent text-white font-semibold text-sm py-3 px-4 rounded-lg hover:bg-accent-hover active:opacity-80 disabled:opacity-50 transition-colors flex-1 sm:flex-none"
        >
          {loading ? "..." : "Add card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text active:opacity-70 px-4 py-3 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
