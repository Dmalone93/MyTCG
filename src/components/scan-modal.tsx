"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

type ScanResult = {
  codes: string[];
  text: string;
  bestGuess: string | null;
  labels: string[];
  cardName: string | null;
  rarity: string | null;
  color: string | null;
};

/** Accumulated evidence across multiple frames */
type Evidence = {
  codes: Map<string, number>;       // code → times seen
  textFragments: string[];           // all OCR text collected
  labels: Map<string, number>;       // label → times seen
  cardNames: Map<string, number>;    // detected name → times seen
  rarities: Map<string, number>;     // rarity → times seen
  colors: Map<string, number>;       // color → times seen
  bestGuesses: Map<string, number>;  // guess → times seen
  frameCount: number;
};

function createEvidence(): Evidence {
  return {
    codes: new Map(),
    textFragments: [],
    labels: new Map(),
    cardNames: new Map(),
    rarities: new Map(),
    colors: new Map(),
    bestGuesses: new Map(),
    frameCount: 0,
  };
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntry(map: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [k, v] of map) {
    if (!best || v > best[1]) best = [k, v];
  }
  return best;
}

const CONFIDENCE_THRESHOLD = 2; // Need code seen in 2+ frames to auto-match

export function ScanModal({
  onResult,
  onClose,
}: {
  onResult: (card: CatalogCard) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanGenRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingScanRef = useRef(false);
  const evidenceRef = useRef<Evidence>(createEvidence());

  const [status, setStatus] = useState("Starting camera...");
  const [confidence, setConfidence] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedCards, setMatchedCards] = useState<CatalogCard[]>([]);

  // Start camera — portrait on mobile
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not available on this device");
      return;
    }

    const isMobile = window.innerWidth < 640;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: isMobile ? { ideal: 720 } : { ideal: 1280 },
          height: isMobile ? { ideal: 1280 } : { ideal: 960 },
          aspectRatio: isMobile ? { ideal: 3 / 4 } : { ideal: 4 / 3 },
        },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
        setStatus("Point camera at a card");
      })
      .catch(() => {
        setStatus("Camera access denied — use file upload instead");
      });

    return () => {
      stopScanning();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start auto-scanning when camera is ready
  useEffect(() => {
    if (cameraReady) {
      startScanning();
    }
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]);

  function startScanning() {
    stopScanning();
    scanGenRef.current++;
    setScanning(true);
    pendingScanRef.current = false;
    evidenceRef.current = createEvidence();
    setConfidence(0);

    scanFrame();
    scanTimerRef.current = setInterval(scanFrame, 600);
  }

  function stopScanning() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanning(false);
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    const w = Math.min(640, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  }

  const scanFrame = useCallback(async () => {
    if (pendingScanRef.current) return;
    pendingScanRef.current = true;

    const gen = scanGenRef.current;
    const base64 = captureFrame();
    if (!base64) {
      pendingScanRef.current = false;
      return;
    }

    try {
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (gen !== scanGenRef.current) {
        pendingScanRef.current = false;
        return;
      }

      const data: ScanResult = await res.json();
      const ev = evidenceRef.current;
      ev.frameCount++;

      // Accumulate evidence
      for (const code of data.codes ?? []) increment(ev.codes, code);
      if (data.text) ev.textFragments.push(data.text);
      for (const label of data.labels ?? []) increment(ev.labels, label);
      if (data.cardName) increment(ev.cardNames, data.cardName);
      if (data.rarity) increment(ev.rarities, data.rarity);
      if (data.color) increment(ev.colors, data.color);
      if (data.bestGuess) increment(ev.bestGuesses, data.bestGuess);

      // Check for high-confidence code match
      const topCode = topEntry(ev.codes);

      if (topCode && topCode[1] >= CONFIDENCE_THRESHOLD) {
        // Strong match — seen same code in multiple frames
        stopScanning();
        setConfidence(100);
        setStatus(`Confirmed: ${topCode[0]} (${topCode[1]} frames)`);
        await lookupCard(topCode[0], buildAggregatedResult(ev));
      } else if (topCode) {
        // Seen a code once — building confidence
        const pct = Math.min(90, Math.round((topCode[1] / CONFIDENCE_THRESHOLD) * 80));
        setConfidence(pct);
        setStatus(`Detecting: ${topCode[0]}...`);
      } else if (ev.frameCount >= 5 && ev.cardNames.size > 0) {
        // No code but have accumulated card names — try name-based
        const topName = topEntry(ev.cardNames);
        if (topName && topName[1] >= 2) {
          stopScanning();
          setConfidence(70);
          setStatus(`Detected: ${topName[0]}`);
          await lookupByName(topName[0], buildAggregatedResult(ev));
        } else {
          setConfidence(Math.min(50, ev.frameCount * 8));
          setStatus(`Reading card... (frame ${ev.frameCount})`);
        }
      } else if (ev.frameCount > 0) {
        // Still gathering data
        const bestGuess = topEntry(ev.bestGuesses);
        const pct = Math.min(40, ev.frameCount * 7);
        setConfidence(pct);
        if (bestGuess) {
          setStatus(`Seeing: ${bestGuess[0]}...`);
        } else {
          setStatus(`Scanning... (frame ${ev.frameCount})`);
        }
      }
    } catch {
      // Network error — keep scanning
    }
    pendingScanRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildAggregatedResult(ev: Evidence): ScanResult {
    const allText = ev.textFragments.join("\n");
    const allLabels = [...ev.labels.keys()];
    const topCode = topEntry(ev.codes);
    const topName = topEntry(ev.cardNames);
    const topRarity = topEntry(ev.rarities);
    const topColor = topEntry(ev.colors);
    const topGuess = topEntry(ev.bestGuesses);

    return {
      codes: topCode ? [topCode[0]] : [],
      text: allText.slice(0, 500),
      bestGuess: topGuess?.[0] ?? null,
      labels: allLabels,
      cardName: topName?.[0] ?? null,
      rarity: topRarity?.[0] ?? null,
      color: topColor?.[0] ?? null,
    };
  }

  async function scanFile(file: File) {
    setStatus("Reading card...");
    stopScanning();

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(1280, img.width);
      const h = Math.round((w * img.height) / img.width);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      try {
        const res = await fetch("/api/scan-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const data: ScanResult = await res.json();

        if (data.codes && data.codes.length > 0) {
          setConfidence(100);
          setStatus(`Found: ${data.codes[0]}`);
          await lookupCard(data.codes[0], data);
        } else if (data.cardName) {
          setConfidence(70);
          setStatus(`Detected: ${data.cardName}`);
          await lookupByName(data.cardName, data);
        } else {
          setStatus(
            data.bestGuess
              ? `Detected: ${data.bestGuess} — not a recognized card code`
              : "Card not recognized — try a clearer photo"
          );
        }
      } catch {
        setStatus("API error — try again");
      }
    };
    img.src = URL.createObjectURL(file);
  }

  async function lookupCard(code: string, scanData: ScanResult) {
    try {
      const res = await fetch(
        `/api/search-cards?q=${encodeURIComponent(code)}`
      );
      const cards: CatalogCard[] = await res.json();
      if (cards.length > 0) {
        const ranked = rankMatches(cards, scanData);
        setMatchedCards(ranked.slice(0, 5));
        setStatus(`Matched: ${ranked[0].cardName}`);
      } else {
        setMatchedCards([]);
        setStatus(`Found code ${code} but no catalog match`);
      }
    } catch {
      setStatus(`Found code ${code} — catalog lookup failed`);
    }
  }

  async function lookupByName(name: string, scanData: ScanResult) {
    try {
      const cleanName = name
        .replace(/one piece (tcg|card game)/i, "")
        .replace(/trading card/i, "")
        .trim();
      if (!cleanName) return;

      const res = await fetch(
        `/api/search-cards?q=${encodeURIComponent(cleanName)}`
      );
      const cards: CatalogCard[] = await res.json();
      if (cards.length > 0) {
        const ranked = rankMatches(cards, scanData);
        setMatchedCards(ranked.slice(0, 5));
        setStatus(`Matched: ${ranked[0].cardName}`);
      }
    } catch {
      // Silent fail
    }
  }

  function rankMatches(cards: CatalogCard[], scanData: ScanResult): CatalogCard[] {
    const text = (scanData.text ?? "").toUpperCase();
    const labels = (scanData.labels ?? []).map((l) => l.toUpperCase());
    const allText = text + " " + labels.join(" ") + " " + (scanData.bestGuess ?? "").toUpperCase();

    return [...cards].sort((a, b) => {
      return matchScore(b, allText, scanData) - matchScore(a, allText, scanData);
    });
  }

  function matchScore(card: CatalogCard, text: string, scanData: ScanResult): number {
    let score = 0;

    // Exact code match
    if (text.includes(card.cardSetId.toUpperCase())) score += 100;

    // Card name words
    const nameParts = card.cardName.toUpperCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && text.includes(part)) score += 10;
    }

    // Set name
    if (text.includes(card.setName.toUpperCase())) score += 5;

    // Rarity match from accumulated evidence
    if (scanData.rarity && card.rarity.toUpperCase().includes(scanData.rarity.toUpperCase())) {
      score += 15;
    }

    // Color match from accumulated evidence
    if (scanData.color && card.cardColor.toUpperCase().includes(scanData.color.toUpperCase())) {
      score += 10;
    }

    // Rarity text in OCR
    const rarityMap: Record<string, string[]> = {
      "SEC": ["SEC", "SECRET"],
      "SR": ["SR", "SUPER RARE"],
      "R": ["RARE"],
      "UC": ["UC", "UNCOMMON"],
      "C": ["COMMON"],
      "L": ["LEADER"],
      "SP": ["SP", "SPECIAL"],
      "ALT": ["ALT", "ALTERNATE", "MANGA"],
    };
    for (const [key, aliases] of Object.entries(rarityMap)) {
      if (card.rarity.toUpperCase().includes(key)) {
        for (const alias of aliases) {
          if (text.includes(alias)) score += 5;
        }
      }
    }

    // Color in text
    const colors = ["RED", "BLUE", "GREEN", "PURPLE", "BLACK", "YELLOW"];
    for (const color of colors) {
      if (card.cardColor.toUpperCase().includes(color) && text.includes(color)) {
        score += 3;
      }
    }

    return score;
  }

  const confidenceColor =
    confidence >= 80 ? "#4ADE80" : confidence >= 40 ? "#FACC15" : "rgba(255,255,255,0.2)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
          <h2 className="font-semibold text-sm text-text">Scan Card</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text active:opacity-70 text-lg p-1 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Camera — portrait on mobile, landscape on desktop */}
        <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {scanning && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Scan frame corners */}
              <div className="absolute inset-4 border-2 border-accent/30 rounded-lg">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
              </div>
              {/* Confidence bar at bottom of camera */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[rgba(0,0,0,0.5)]">
                <div
                  className="h-full transition-all duration-300 ease-out rounded-r-full"
                  style={{
                    width: `${confidence}%`,
                    backgroundColor: confidenceColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-text-muted">{status}</span>
          {scanning && confidence > 0 && (
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: confidenceColor }}
            >
              {confidence}%
            </span>
          )}
        </div>

        {/* Matched cards */}
        {matchedCards.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.04)]">
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[.08em] uppercase text-text-dim">
              Select a match
            </div>
            {matchedCards.map((card, i) => (
              <button
                key={card.cardSetId + i}
                onClick={() => onResult(card)}
                className="flex items-center gap-2.5 w-full text-left px-3 py-3 sm:py-2 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(59,130,246,0.08)] active:opacity-80 transition-colors"
              >
                <div className="relative w-8 h-[44px] flex-none rounded overflow-hidden bg-[#1C1C1F]">
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-text block truncate">
                    {card.cardName}
                  </span>
                  <span className="text-[10px] text-text-dim">
                    {card.cardSetId} · {card.rarity} · {card.cardColor}
                  </span>
                </span>
                {card.marketPrice != null && card.marketPrice > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#4ADE80] flex-none">
                    €{card.marketPrice.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-[rgba(255,255,255,0.04)]">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scanFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 bg-bg-surface border border-[rgba(255,255,255,0.06)] text-text font-semibold text-sm py-3 px-4 rounded-lg hover:bg-[#27272A] active:opacity-80 transition-colors"
          >
            Upload photo
          </button>
          {!scanning && cameraReady && matchedCards.length === 0 && (
            <button
              onClick={startScanning}
              className="flex-1 bg-accent text-white font-semibold text-sm py-3 px-4 rounded-lg hover:bg-accent-hover active:opacity-80 transition-colors"
            >
              Scan again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
