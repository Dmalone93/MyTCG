"use client";

import { useState } from "react";
import type { CollectionCard, CardPrice } from "./collection-shell";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

const GRADE_ORDER = [
  "PSA 10",
  "PSA 9",
  "PSA 8",
  "BGS 10",
  "BGS 9.5",
  "CGC 10",
  "CGC 9.5",
  "Graded",
];

export function CardDetailModal({
  card,
  price,
  onClose,
  onUpdate,
  onDelete,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(card.quantity);
  const [condition, setCondition] = useState(card.condition ?? "NM");
  const [isGraded, setIsGraded] = useState(card.is_graded);
  const [grade, setGrade] = useState(card.grade ?? "");
  const [gradedCompany, setGradedCompany] = useState(card.graded_company ?? "");
  const [acquiredPrice, setAcquiredPrice] = useState(
    card.acquired_price != null ? String(card.acquired_price) : ""
  );
  const [notes, setNotes] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);

  const market = price?.raw_market ?? null;
  const paid = card.acquired_price ?? 0;
  const pl = market != null ? (market - paid) * card.quantity : null;
  const plColor =
    pl != null ? (pl >= 0 ? "#4ADE80" : "#F87171") : undefined;

  const gradedPrices = price?.graded_prices ?? {};
  const sortedGrades = GRADE_ORDER.filter((g) => g in gradedPrices);

  async function handleSave() {
    setSaving(true);
    await onUpdate(card.id, {
      quantity,
      condition,
      is_graded: isGraded,
      grade: grade || null,
      graded_company: gradedCompany || null,
      acquired_price: acquiredPrice ? parseFloat(acquiredPrice) : null,
      notes: notes || null,
    });
    setSaving(false);
    setEditing(false);
  }

  const inputClass =
    "bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-text focus:outline-2 focus:outline-accent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-elevated border-b border-[rgba(255,255,255,0.04)] px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <div className="font-mono text-xs text-text-dim mb-1">
              {card.card_code}
            </div>
            <h2 className="font-semibold text-lg text-text leading-tight">
              {card.card_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text text-xl leading-none mt-1 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Image */}
          {card.image_url && (
            <img
              src={card.image_url}
              alt={card.card_name}
              className="w-full max-w-[240px] mx-auto rounded-lg aspect-[2.5/3.5] object-cover"
            />
          )}

          {/* Price info */}
          <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">
                Market price
              </span>
              <span className="font-mono font-semibold text-lg">
                {market != null ? fmt(market) : "—"}
              </span>
            </div>

            {card.acquired_price != null && (
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">
                  Paid
                </span>
                <span className="font-mono font-semibold text-lg">
                  {fmt(card.acquired_price)}
                </span>
              </div>
            )}

            {pl != null && (
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">
                  P/L ({card.quantity}x)
                </span>
                <span
                  className="font-mono font-semibold text-lg"
                  style={{ color: plColor }}
                >
                  {pl >= 0 ? "+" : ""}
                  {fmt(pl)}
                </span>
              </div>
            )}
          </div>

          {/* Graded price ladder */}
          {sortedGrades.length > 0 && (
            <div>
              <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-2">
                Graded prices
              </div>
              <div className="bg-[rgba(255,255,255,0.02)] rounded-xl overflow-hidden">
                {sortedGrades.map((g) => (
                  <div
                    key={g}
                    className="flex justify-between items-center px-4 py-2.5 border-b border-[rgba(255,255,255,0.03)] last:border-0"
                  >
                    <span className="text-sm text-text-muted">{g}</span>
                    <span className="font-mono font-semibold text-sm text-[#4ADE80]">
                      {fmt(gradedPrices[g])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details / Edit */}
          {!editing ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-dim">Quantity</span>
                <span>{card.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">Condition</span>
                <span>{card.condition ?? "—"}</span>
              </div>
              {card.is_graded && (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-dim">Grade</span>
                    <span>
                      {card.graded_company} {card.grade}
                    </span>
                  </div>
                </>
              )}
              {card.notes && (
                <div>
                  <span className="text-text-dim block mb-1">Notes</span>
                  <p className="text-text text-sm">{card.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 bg-bg-surface border border-[rgba(255,255,255,0.06)] text-text font-semibold text-sm py-2 px-4 rounded-lg hover:bg-[#27272A] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Delete "${card.card_name}"?`)) {
                      await onDelete(card.id);
                      onClose();
                    }
                  }}
                  className="bg-bg-surface border border-[rgba(255,255,255,0.06)] text-red-400 font-semibold text-sm py-2 px-4 rounded-lg hover:bg-red-400/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(parseInt(e.target.value) || 1)
                    }
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
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGraded}
                    onChange={(e) => setIsGraded(e.target.checked)}
                    className="accent-accent"
                  />
                  Graded
                </label>
              </div>

              {isGraded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
                      Company
                    </label>
                    <select
                      value={gradedCompany}
                      onChange={(e) => setGradedCompany(e.target.value)}
                      className={inputClass + " w-full"}
                    >
                      <option value="">—</option>
                      <option value="PSA">PSA</option>
                      <option value="BGS">BGS</option>
                      <option value="CGC">CGC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
                      Grade
                    </label>
                    <input
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="10"
                      className={inputClass + " w-full"}
                    />
                  </div>
                </div>
              )}

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

              <div>
                <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={inputClass + " w-full resize-none"}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-accent text-white font-semibold text-sm py-2 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {saving ? "..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm text-text-muted hover:text-text px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
