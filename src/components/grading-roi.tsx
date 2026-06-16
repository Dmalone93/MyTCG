"use client";

import { useState } from "react";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}

type GradedPrices = Record<string, number>;

const GRADE_ORDER = ["PSA 10", "PSA 9", "PSA 8", "BGS 10", "BGS 9.5", "CGC 10", "CGC 9.5"];

export function GradingROI({
  rawPrice,
  gradedPrices,
}: {
  rawPrice: number;
  gradedPrices: GradedPrices;
}) {
  const [gradingCost, setGradingCost] = useState(20);

  const grades = GRADE_ORDER.filter((g) => g in gradedPrices && gradedPrices[g] > 0);

  if (grades.length === 0 || rawPrice <= 0) return null;

  const rows = grades.map((grade) => {
    const graded = gradedPrices[grade];
    const profit = graded - rawPrice - gradingCost;
    const roi = ((profit) / (rawPrice + gradingCost)) * 100;
    return { grade, graded, profit, roi };
  });

  const best = rows.reduce((a, b) => (b.roi > a.roi ? b : a), rows[0]);

  return (
    <div className="bg-bg-surface rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-text">Grading ROI</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-dim">Cost</label>
          <input
            type="number"
            value={gradingCost}
            onChange={(e) => setGradingCost(parseInt(e.target.value) || 0)}
            className="w-16 bg-bg-elevated border border-[rgba(0,0,0,0.08)] rounded px-2 py-1 text-sm text-text text-right"
          />
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.grade}
            className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${
              row.grade === best.grade ? "bg-[rgba(5,150,105,0.06)]" : ""
            }`}
          >
            <span className="w-[70px] text-text-muted flex-none">{row.grade}</span>
            <span className="font-mono text-text flex-none w-[70px] text-right">{fmt(row.graded)}</span>
            <span className={`font-mono flex-none w-[70px] text-right font-semibold ${
              row.profit >= 0 ? "text-[#059669]" : "text-[#DC2626]"
            }`}>
              {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
            </span>
            <span className={`font-mono flex-1 text-right font-semibold ${
              row.roi >= 0 ? "text-[#059669]" : "text-[#DC2626]"
            }`}>
              {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(0)}%
            </span>
            {row.grade === best.grade && (
              <span className="text-xs font-semibold text-[#059669] bg-[rgba(5,150,105,0.1)] px-1.5 py-0.5 rounded flex-none">
                Best
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
