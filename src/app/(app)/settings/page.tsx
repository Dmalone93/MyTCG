"use client";

import { useState, useEffect } from "react";
import { useRegion, type Region } from "@/components/region-selector";

type Collection = {
  id: string;
  name: string;
  cardCount?: number;
};

export default function SettingsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { config, setRegion } = useRegion();
  const [defaultView, setDefaultView] = useState<"list" | "grid">("grid");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load collections
    fetch("/api/collections")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCollections(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load preferences
    const view = localStorage.getItem("mytcg-default-view");
    if (view === "list" || view === "grid") setDefaultView(view);
  }, []);

  async function createCollection() {
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Collection" }),
      });
      if (res.ok) {
        const col = await res.json();
        setCollections((prev) => [...prev, col]);
      }
    } catch { /* */ }
  }

  async function renameCollection(id: string) {
    if (!editName.trim()) return;
    try {
      await fetch("/api/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      setCollections((prev) =>
        prev.map((c) => c.id === id ? { ...c, name: editName.trim() } : c)
      );
    } catch { /* */ }
    setEditingId(null);
  }

  async function deleteCollection(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its cards? This cannot be undone.`)) return;
    try {
      await fetch("/api/collections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch { /* */ }
  }

  function savePreferences() {
    localStorage.setItem("mytcg-default-view", defaultView);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-bold text-text mb-6">Settings</h1>

      {/* Pricing region */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text mb-3">Pricing Region</h2>
        <p className="text-sm text-text-muted mb-3">Choose which currency to display prices in.</p>
        <div className="flex gap-2">
          {([
            { region: "UK" as Region, label: "UK", desc: "GBP (£)", flag: "🇬🇧" },
            { region: "EU" as Region, label: "Europe", desc: "EUR (€)", flag: "🇪🇺" },
            { region: "US" as Region, label: "United States", desc: "USD ($)", flag: "🇺🇸" },
          ]).map((r) => (
            <button
              key={r.region}
              onClick={() => setRegion(r.region)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border transition-colors ${
                config.region === r.region
                  ? "border-text bg-bg-surface"
                  : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
              }`}
            >
              <span className="text-lg">{r.flag}</span>
              <span className="text-sm font-medium text-text">{r.label}</span>
              <span className="text-xs text-text-dim">{r.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Default view */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text mb-3">Default View</h2>
        <p className="text-sm text-text-muted mb-3">How cards are displayed in your collections.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setDefaultView("list")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors ${
              defaultView === "list"
                ? "border-text bg-bg-surface"
                : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span className="text-sm font-medium text-text">List</span>
          </button>
          <button
            onClick={() => setDefaultView("grid")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors ${
              defaultView === "grid"
                ? "border-text bg-bg-surface"
                : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="text-sm font-medium text-text">Grid</span>
          </button>
        </div>
        <button
          onClick={savePreferences}
          className="mt-3 text-sm text-text-muted hover:text-text active:opacity-70 transition-colors"
        >
          {saved ? "✓ Saved" : "Save preference"}
        </button>
      </section>

      {/* Collections */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Collections</h2>
          <button
            onClick={createCollection}
            className="text-sm text-text-muted hover:text-text active:opacity-70 transition-colors"
          >
            + New
          </button>
        </div>
        <p className="text-sm text-text-muted mb-3">Manage your card collections. Double-click a name to rename.</p>

        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-bg-surface rounded-xl animate-pulse" />)}
          </div>
        )}

        <div className="space-y-1.5">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-3 bg-bg-surface rounded-xl px-4 py-3"
            >
              {editingId === col.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => renameCollection(col.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameCollection(col.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-text"
                />
              ) : (
                <span
                  className={`flex-1 text-sm cursor-pointer ${col.name === "New Collection" ? "text-text-dim" : "text-text"}`}
                  onDoubleClick={() => { setEditingId(col.id); setEditName(col.name); }}
                >
                  {col.name}
                </span>
              )}
              <button
                onClick={() => deleteCollection(col.id, col.name)}
                className="text-sm text-text-dim hover:text-[#DC2626] active:opacity-70 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Data */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text mb-3">Data</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Price data source</span>
            <span className="text-text">optcgapi + JustTCG</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Card database</span>
            <span className="text-text">onepiece-cardgame.dev</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Live prices</span>
            <span className="text-text">JustTCG (on-demand)</span>
          </div>
        </div>
      </section>
    </div>
  );
}
