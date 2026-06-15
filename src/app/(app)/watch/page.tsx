"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CardIndex = Array<{ id: string; n: string; r: string; c: string; img: string }>;

type DetectedCard = {
  code: string;
  name: string;
  rarity: string;
  color: string;
  imageUrl: string;
  marketPrice: number | null;
  detectedAt: number;
};

function extractCodesLocal(text: string): string[] {
  const codes: string[] = [];
  const up = text.toUpperCase();
  const re = /(OP|ST|EB|PRB)\s*[O0]?(\d{1,2})\s*[-\s.]\s*(\d{2,3})/g;
  let m;
  while ((m = re.exec(up)) !== null) {
    codes.push(m[1] + m[2].padStart(2, "0") + "-" + m[3].padStart(3, "0"));
  }
  const pre = /P\s*[-\s.]\s*(\d{3})/g;
  while ((m = pre.exec(up)) !== null) codes.push("P-" + m[1]);
  return [...new Set(codes)];
}

function matchLocalIndex(text: string, index: CardIndex): CardIndex {
  if (!text || text.length < 3) return [];
  const textUp = text.toUpperCase();
  const codes = extractCodesLocal(text);
  if (codes.length > 0) {
    const matches = index.filter((c) => codes.some((code) => c.id.toUpperCase() === code));
    if (matches.length > 0) return matches;
  }
  const scored = index
    .map((card) => {
      let score = 0;
      const nameUp = card.n.toUpperCase();
      const words = nameUp.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) {
        if (textUp.includes(word)) score += word.length;
      }
      if (textUp.includes(nameUp)) score += 100;
      return { card, score };
    })
    .filter((s) => s.score > 8)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.card);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

export default function WatchPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef(false);
  const cardIndexRef = useRef<CardIndex>([]);
  const priceCache = useRef<Map<string, number | null>>(new Map());

  const [watching, setWatching] = useState(false);
  const [detected, setDetected] = useState<DetectedCard[]>([]);
  const [status, setStatus] = useState("Start watching to identify cards from streams");
  const [scanCount, setScanCount] = useState(0);

  // Load card index
  useEffect(() => {
    fetch("/api/card-index")
      .then((r) => r.json())
      .then((data: CardIndex) => { cardIndexRef.current = data; })
      .catch(() => {});
  }, []);

  async function startWatching() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Stop if user ends sharing
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopWatching();
      });

      setWatching(true);
      setStatus("Watching... cards will appear below");
      setDetected([]);
      setScanCount(0);

      // Scan every 1.5s — not too aggressive on API
      scanTimerRef.current = setInterval(scanFrame, 1500);
    } catch {
      setStatus("Screen sharing cancelled or not supported");
    }
  }

  function stopWatching() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWatching(false);
    setStatus(detected.length > 0 ? `Done — found ${detected.length} cards` : "Stopped watching");
  }

  const scanFrame = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      pendingRef.current = false;
      return;
    }

    // Capture frame
    const canvas = document.createElement("canvas");
    const w = Math.min(640, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];

    setScanCount((c) => c + 1);

    try {
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, fast: true }),
      });
      const data = await res.json();

      const allText = [data.text, data.bestGuess, data.cardName, ...(data.labels ?? [])].filter(Boolean).join(" ");
      const matches = matchLocalIndex(allText, cardIndexRef.current);

      // Also check direct codes
      const codes = data.codes ?? [];

      const newCards: DetectedCard[] = [];

      for (const code of codes) {
        const indexMatch = cardIndexRef.current.find((c) => c.id.toUpperCase() === code.toUpperCase());
        if (indexMatch) {
          newCards.push({
            code: indexMatch.id,
            name: indexMatch.n,
            rarity: indexMatch.r,
            color: indexMatch.c,
            imageUrl: indexMatch.img,
            marketPrice: await getPrice(indexMatch.id),
            detectedAt: Date.now(),
          });
        }
      }

      for (const match of matches) {
        if (!newCards.some((c) => c.code === match.id)) {
          newCards.push({
            code: match.id,
            name: match.n,
            rarity: match.r,
            color: match.c,
            imageUrl: match.img,
            marketPrice: await getPrice(match.id),
            detectedAt: Date.now(),
          });
        }
      }

      if (newCards.length > 0) {
        setDetected((prev) => {
          const existing = new Set(prev.map((c) => c.code));
          const fresh = newCards.filter((c) => !existing.has(c.code));
          if (fresh.length === 0) return prev;
          return [...fresh, ...prev].slice(0, 50);
        });
        setStatus(`Detected ${newCards.map((c) => c.name).join(", ")}`);
      }
    } catch {
      // Vision API error — continue
    }

    pendingRef.current = false;
  }, []);

  async function getPrice(code: string): Promise<number | null> {
    if (priceCache.current.has(code)) return priceCache.current.get(code) ?? null;

    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(code)}`);
      const cards = await res.json();
      const price = cards[0]?.marketPrice ?? null;
      priceCache.current.set(code, price);
      return price;
    } catch {
      return null;
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-text">Watch</h2>
        <div className="flex-1" />
        {!watching ? (
          <button
            onClick={startWatching}
            className="border border-[rgba(255,255,255,0.12)] text-text font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[rgba(255,255,255,0.05)] active:opacity-70 transition-colors"
          >
            Share screen
          </button>
        ) : (
          <button
            onClick={stopWatching}
            className="border border-[rgba(255,255,255,0.08)] text-text-muted font-medium text-sm py-2.5 px-4 rounded-lg hover:text-text active:opacity-70 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Status */}
      <div className="text-sm text-text-dim mb-4 flex items-center gap-2">
        {watching && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
        <span>{status}</span>
        {watching && <span className="text-[10px] font-mono text-text-dim ml-auto">{scanCount} scans</span>}
      </div>

      {/* Video preview — small */}
      {watching && (
        <div className="mb-4 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.06)] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[200px] object-contain"
          />
        </div>
      )}

      {/* Hidden video element when not visible */}
      {!watching && <video ref={videoRef} className="hidden" />}

      {/* Detected cards */}
      {detected.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-text-muted">
              Cards detected ({detected.length})
            </h3>
            {!watching && (
              <button
                onClick={() => setDetected([])}
                className="text-xs text-text-dim hover:text-text-muted ml-auto"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-2">
            {detected.map((card) => (
              <div
                key={card.code + card.detectedAt}
                className="flex items-center gap-3 bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl p-3"
              >
                <div className="w-12 h-[67px] rounded-md overflow-hidden bg-[#1C1C1F] flex-none">
                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-text truncate">{card.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[11px] text-text-dim">{card.code}</span>
                    <span className="text-[10px] text-text-dim">·</span>
                    <span className="text-[10px] text-text-dim">{card.rarity}</span>
                    <span className="text-[10px] text-text-dim">·</span>
                    <span className="text-[10px] text-text-dim">{card.color}</span>
                  </div>
                </div>
                <div className="text-right flex-none">
                  {card.marketPrice != null && card.marketPrice > 0 ? (
                    <div className="font-mono text-sm font-semibold text-[#34D399]">{fmt(card.marketPrice)}</div>
                  ) : (
                    <div className="font-mono text-xs text-text-dim">—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!watching && detected.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-dim text-sm mb-2">Share your screen while watching a TCG stream</div>
          <div className="text-text-dim text-xs">Cards shown on screen will be identified with market prices</div>
        </div>
      )}
    </div>
  );
}
