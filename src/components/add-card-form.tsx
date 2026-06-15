"use client";

import { useState } from "react";
import type { CollectionCard } from "./collection-shell";

type NewCard = Omit<CollectionCard, "id" | "user_id" | "collection_id" | "created_at">;

export function AddCardForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (card: NewCard) => Promise<void>;
  onCancel: () => void;
}) {
  const [cardCode, setCardCode] = useState("");
  const [cardName, setCardName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("NM");
  const [acquiredPrice, setAcquiredPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardCode.trim() || !cardName.trim()) return;
    setLoading(true);
    await onSubmit({
      card_code: cardCode.trim().toUpperCase(),
      card_name: cardName.trim(),
      quantity,
      condition,
      is_graded: false,
      grade: null,
      graded_company: null,
      acquired_price: acquiredPrice ? parseFloat(acquiredPrice) : null,
      notes: null,
      image_url: null,
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
      <div className="grid grid-cols-[1fr_2fr] gap-3">
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
      <div className="grid grid-cols-3 gap-3">
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
          className="inline-flex items-center gap-2 bg-accent text-white font-semibold text-sm py-2 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "Add card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text px-4 py-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
