"use client";

import { useState, useEffect } from "react";
import type { CollectionCard, CardPrice } from "./collection-shell";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

const GRADE_ORDER = ["PSA 10", "PSA 9", "PSA 8", "BGS 10", "BGS 9.5", "CGC 10", "CGC 9.5", "Graded"];

type ExtData = {
  card: {
    type: string; color: string; cost: number | null; power: number | null;
    life: number | null; rarity: string; traits: string; effect: string;
    altArt: string | null; setName: string; counterPower: number | null;
  };
  synergies: Array<{ cid: string; name: string; imageUrl: string }>;
};

export function CardDetailModal({
  card, price, onClose, onUpdate, onDelete,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(card.quantity ?? 1);
  const [condition, setCondition] = useState(card.condition ?? "NM");
  const [isGraded, setIsGraded] = useState(card.isGraded ?? false);
  const [grade, setGrade] = useState(card.grade ?? "");
  const [gradedCompany, setGradedCompany] = useState(card.gradedCompany ?? "");
  const [acquiredPrice, setAcquiredPrice] = useState(card.acquiredPrice ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<ExtData | null>(null);

  useEffect(() => {
    fetch(`/api/card-info?code=${encodeURIComponent(card.cardCode)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setExt(data); })
      .catch(() => {});
  }, [card.cardCode]);

  const market = num(price?.rawMarket);
  const paid = num(card.acquiredPrice);
  const pl = market > 0 ? (market - paid) * (card.quantity ?? 1) : null;
  const plColor = pl != null ? (pl >= 0 ? "#34D399" : "#F87171") : undefined;
  const gradedPrices = (price?.gradedPrices as Record<string, number> | null) ?? {};
  const sortedGrades = GRADE_ORDER.filter((g) => g in gradedPrices);

  const c = ext?.card;

  async function handleSave() {
    setSaving(true);
    await onUpdate(card.id, { quantity, condition, isGraded, grade: grade || null, gradedCompany: gradedCompany || null, acquiredPrice: acquiredPrice || null, notes: notes || null });
    setSaving(false);
    setEditing(false);
  }

  const inputClass = "bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-text focus:outline-2 focus:outline-accent";

  // Data rows for the property table
  const dataRows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Name", value: card.cardName },
    { label: "Card ID", value: card.cardCode },
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="font-semibold text-base sm:text-lg text-text truncate">{card.cardName}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none">×</button>
        </div>

        {!editing ? (
          <>
            {/* Image + Data table */}
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-[220px] flex-none p-4 sm:p-5 flex justify-center sm:justify-start">
                {card.imageUrl && (
                  <img src={card.imageUrl} alt={card.cardName} className="w-[150px] sm:w-full rounded-lg aspect-[2.5/3.5] object-cover" />
                )}
              </div>

              <div className="flex-1 min-w-0 sm:border-l border-[rgba(255,255,255,0.04)]">
                {/* Market price */}
                {market > 0 && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                    <span className="text-xs text-text-dim font-mono uppercase">Market</span>
                    <span className="font-mono text-lg font-semibold text-[#34D399]">{fmt(market)}</span>
                  </div>
                )}
                {paid > 0 && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
                    <span className="text-xs text-text-dim font-mono uppercase">Paid</span>
                    <span className="font-mono text-sm">{fmt(paid)}</span>
                  </div>
                )}
                {pl != null && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
                    <span className="text-xs text-text-dim font-mono uppercase">P/L ({card.quantity ?? 1}x)</span>
                    <span className="font-mono text-sm font-semibold" style={{ color: plColor }}>{pl >= 0 ? "+" : ""}{fmt(pl)}</span>
                  </div>
                )}

                {/* Data rows */}
                {dataRows.map((row) => {
                  if (!row.value) return null;
                  const isEffect = row.label === "Effect";
                  return (
                    <div key={row.label} className="flex border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <div className="w-[110px] sm:w-[130px] flex-none px-4 sm:px-5 py-2 text-xs text-text-dim">{row.label}</div>
                      <div className={`flex-1 px-4 sm:px-5 py-2 text-sm text-text ${isEffect ? "whitespace-pre-line leading-relaxed" : "text-right"}`}>{row.value}</div>
                    </div>
                  );
                })}

                {!ext && (
                  <div className="px-4 py-4 text-center text-text-dim text-xs animate-pulse">Loading...</div>
                )}
              </div>
            </div>

            {/* Graded prices */}
            {sortedGrades.length > 0 && (
              <div className="border-t border-[rgba(255,255,255,0.06)] px-4 sm:px-5 py-3">
                <div className="text-[10px] font-mono text-text-dim uppercase mb-2">Graded Prices</div>
                {sortedGrades.map((g) => (
                  <div key={g} className="flex justify-between py-1.5 text-sm">
                    <span className="text-text-muted">{g}</span>
                    <span className="font-mono font-semibold text-[#34D399]">{fmt(gradedPrices[g])}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Collection info */}
            <div className="border-t border-[rgba(255,255,255,0.06)] px-4 sm:px-5 py-3">
              <div className="text-[10px] font-mono text-text-dim uppercase mb-2">Your Copy</div>
              <div className="flex justify-between text-sm py-1"><span className="text-text-dim">Quantity</span><span>{card.quantity ?? 1}</span></div>
              <div className="flex justify-between text-sm py-1"><span className="text-text-dim">Condition</span><span>{card.condition ?? "—"}</span></div>
              {card.isGraded && <div className="flex justify-between text-sm py-1"><span className="text-text-dim">Grade</span><span>{card.gradedCompany} {card.grade}</span></div>}
              {card.notes && <div className="mt-2"><span className="text-text-dim text-xs block mb-1">Notes</span><p className="text-sm text-text">{card.notes}</p></div>}
            </div>

            {/* Synergies */}
            {ext && ext.synergies.length > 0 && (
              <div className="border-t border-[rgba(255,255,255,0.06)] px-4 sm:px-5 py-3">
                <div className="text-[10px] font-mono text-text-dim uppercase mb-2">Synergies</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ext.synergies.map((s) => (
                    <div key={s.cid} className="flex-none w-[60px]">
                      <div className="aspect-[2.5/3.5] rounded overflow-hidden bg-[#1C1C1F] mb-1">
                        <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="text-[9px] text-text-dim truncate">{s.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-[rgba(255,255,255,0.06)] px-4 sm:px-5 py-3 flex gap-2">
              <button onClick={() => setEditing(true)} className="flex-1 border border-[rgba(255,255,255,0.1)] text-text font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[rgba(255,255,255,0.04)] active:opacity-70 transition-colors">Edit</button>
              <button onClick={async () => { if (confirm(`Delete "${card.cardName}"?`)) { await onDelete(card.id); onClose(); } }} className="border border-[rgba(255,255,255,0.06)] text-red-400 font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-red-400/10 active:opacity-70 transition-colors">Delete</button>
            </div>
          </>
        ) : (
          /* Edit form */
          <div className="px-4 sm:px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Quantity</label>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={inputClass + " w-full"} />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Condition</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass + " w-full"}>
                  <option value="NM">NM</option><option value="LP">LP</option><option value="MP">MP</option><option value="HP">HP</option><option value="DMG">DMG</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer py-1">
              <input type="checkbox" checked={isGraded} onChange={(e) => setIsGraded(e.target.checked)} className="accent-accent" /> Graded
            </label>
            {isGraded && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Company</label>
                  <select value={gradedCompany} onChange={(e) => setGradedCompany(e.target.value)} className={inputClass + " w-full"}>
                    <option value="">—</option><option value="PSA">PSA</option><option value="BGS">BGS</option><option value="CGC">CGC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Grade</label>
                  <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="10" className={inputClass + " w-full"} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Price paid</label>
              <input type="number" step="0.01" min="0" value={acquiredPrice} onChange={(e) => setAcquiredPrice(e.target.value)} placeholder="0.00" className={inputClass + " w-full"} />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-text-dim mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass + " w-full resize-none"} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving} className="flex-1 border border-[rgba(255,255,255,0.12)] text-text font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[rgba(255,255,255,0.05)] active:opacity-70 disabled:opacity-40 transition-colors">{saving ? "..." : "Save"}</button>
              <button onClick={() => setEditing(false)} className="text-sm text-text-muted hover:text-text active:opacity-70 px-4 py-2.5 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
