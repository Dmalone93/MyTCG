"use client";

import { useState } from "react";

type Company = "Raw" | "PSA" | "CGC" | "BGS";

const GRADES: Record<Exclude<Company, "Raw">, string[]> = {
  PSA: ["10", "9", "8"],
  CGC: ["10", "9.5", "9"],
  BGS: ["10", "9.5", "9"],
};

export function GradeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (grade: string) => void;
}) {
  const parts = value.split(" ");
  const company: Company = (["PSA", "CGC", "BGS"].includes(parts[0]) ? parts[0] : "Raw") as Company;
  const number = parts[1] ?? (company !== "Raw" ? "10" : "");

  function selectCompany(c: Company) {
    if (c === "Raw") {
      onChange("Raw");
    } else {
      onChange(`${c} ${GRADES[c][0]}`);
    }
  }

  function selectNumber(n: string) {
    if (company !== "Raw") onChange(`${company} ${n}`);
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        {(["Raw", "PSA", "CGC", "BGS"] as Company[]).map((c) => (
          <button
            key={c}
            onClick={() => selectCompany(c)}
            className={`px-3 py-2 text-sm rounded-xl transition-colors ${
              company === c
                ? "bg-text text-bg font-medium"
                : "bg-bg-surface text-text-dim hover:text-text"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {company !== "Raw" && (
        <div className="flex gap-1.5">
          {GRADES[company].map((n) => (
            <button
              key={n}
              onClick={() => selectNumber(n)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                number === n
                  ? "bg-bg-surface font-medium text-text border border-text/20"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
