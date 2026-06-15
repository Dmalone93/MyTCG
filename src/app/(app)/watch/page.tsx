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
  const pipWindowRef = useRef<Window | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  const [watching, setWatching] = useState(false);
  const [detected, setDetected] = useState<DetectedCard[]>([]);
  const [status, setStatus] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [isPopped, setIsPopped] = useState(false);

  // Load card index
  useEffect(() => {
    fetch("/api/card-index")
      .then((r) => r.json())
      .then((data: CardIndex) => { cardIndexRef.current = data; })
      .catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatching();
      if (pipWindowRef.current) pipWindowRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      stream.getVideoTracks()[0].addEventListener("ended", () => stopWatching());

      setWatching(true);
      setStatus("Watching...");
      setDetected([]);
      setScanCount(0);

      scanTimerRef.current = setInterval(scanFrame, 1500);
    } catch {
      setStatus("Screen sharing cancelled");
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
    if (videoRef.current) videoRef.current.srcObject = null;
    setWatching(false);
    setStatus("");
  }

  async function popOut() {
    // Try Document Picture-in-Picture API first (Chrome 116+)
    if ("documentPictureInPicture" in window) {
      try {
        const pip = await (window as unknown as { documentPictureInPicture: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture.requestWindow({
          width: 340,
          height: 500,
        });

        pipWindowRef.current = pip;
        setIsPopped(true);

        // Copy styles
        const style = pip.document.createElement("style");
        style.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0A0A0B; color: #ECECEF; font-family: -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-y: auto; }
        `;
        pip.document.head.appendChild(style);

        // Move the widget container into PiP window
        if (widgetContainerRef.current) {
          pip.document.body.appendChild(widgetContainerRef.current);
        }

        pip.addEventListener("pagehide", () => {
          // Move container back when PiP closes
          const main = document.getElementById("watch-anchor");
          if (main && widgetContainerRef.current) {
            main.appendChild(widgetContainerRef.current);
          }
          pipWindowRef.current = null;
          setIsPopped(false);
        });

        return;
      } catch {
        // Fall through to popup
      }
    }

    // Fallback: small popup window
    const popup = window.open(
      "/watch/widget",
      "tcg-watch",
      `width=340,height=500,top=100,left=${window.screen.width - 380},menubar=no,toolbar=no,location=no,status=no`
    );
    if (popup) {
      pipWindowRef.current = popup;
      setIsPopped(true);
    }
  }

  const scanFrame = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    const video = videoRef.current;
    if (!video || !video.videoWidth) { pendingRef.current = false; return; }

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
      const codes = data.codes ?? [];

      const newCards: DetectedCard[] = [];

      for (const code of codes) {
        const m = cardIndexRef.current.find((c) => c.id.toUpperCase() === code.toUpperCase());
        if (m) {
          newCards.push({
            code: m.id, name: m.n, rarity: m.r, color: m.c,
            imageUrl: m.img, marketPrice: await getPrice(m.id), detectedAt: Date.now(),
          });
        }
      }

      for (const match of matches) {
        if (!newCards.some((c) => c.code === match.id)) {
          newCards.push({
            code: match.id, name: match.n, rarity: match.r, color: match.c,
            imageUrl: match.img, marketPrice: await getPrice(match.id), detectedAt: Date.now(),
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
        setStatus(`Found: ${newCards[0].name}`);
      }
    } catch { /* continue */ }

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
    } catch { return null; }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-text">Watch</h2>
        <div className="flex-1" />
        {watching && !isPopped && (
          <button
            onClick={popOut}
            className="border border-[rgba(255,255,255,0.08)] text-text-muted font-medium text-xs py-2 px-3 rounded-lg hover:text-text active:opacity-70 transition-colors"
            title="Pop out as floating widget"
          >
            Pop out ↗
          </button>
        )}
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

      {/* Hidden video for capture */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />

      {/* Status bar */}
      {watching && (
        <div className="text-xs text-text-dim mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span>{status}</span>
          <span className="font-mono ml-auto">{scanCount}</span>
        </div>
      )}

      {/* Widget container — this gets moved into PiP window */}
      <div id="watch-anchor">
        <div ref={widgetContainerRef}>
          {/* Detected cards */}
          {detected.length > 0 && (
            <div style={{ padding: isPopped ? "12px" : undefined }}>
              {!isPopped && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-text-muted">{detected.length} cards found</span>
                  {!watching && (
                    <button onClick={() => setDetected([])} className="text-[10px] text-text-dim hover:text-text-muted ml-auto">Clear</button>
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: isPopped ? "8px" : undefined }} className={isPopped ? "" : "space-y-1.5"}>
                {detected.map((card) => (
                  <div
                    key={card.code}
                    style={isPopped ? {
                      display: "flex", alignItems: "center", gap: "10px",
                      background: "#161618", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "10px", padding: "10px",
                    } : undefined}
                    className={isPopped ? "" : "flex items-center gap-2.5 bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-xl p-2.5"}
                  >
                    <div
                      style={isPopped ? { width: "40px", height: "56px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#1C1C1F" } : undefined}
                      className={isPopped ? "" : "w-10 h-[56px] rounded-md overflow-hidden bg-[#1C1C1F] flex-none"}
                    >
                      <img src={card.imageUrl} alt="" style={isPopped ? { width: "100%", height: "100%", objectFit: "cover" } : undefined} className={isPopped ? "" : "w-full h-full object-cover"} />
                    </div>
                    <div style={isPopped ? { flex: 1, minWidth: 0 } : undefined} className={isPopped ? "" : "flex-1 min-w-0"}>
                      <div
                        style={isPopped ? { fontSize: "13px", fontWeight: 600, color: "#ECECEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
                        className={isPopped ? "" : "font-medium text-sm text-text truncate"}
                      >
                        {card.name}
                      </div>
                      <div
                        style={isPopped ? { fontSize: "10px", color: "#4E4E52", fontFamily: "monospace", marginTop: "2px" } : undefined}
                        className={isPopped ? "" : "font-mono text-[10px] text-text-dim mt-0.5"}
                      >
                        {card.code} · {card.rarity}
                      </div>
                    </div>
                    <div style={isPopped ? { textAlign: "right", flexShrink: 0 } : undefined} className={isPopped ? "" : "text-right flex-none"}>
                      {card.marketPrice != null && card.marketPrice > 0 ? (
                        <div
                          style={isPopped ? { fontFamily: "monospace", fontSize: "14px", fontWeight: 600, color: "#34D399" } : undefined}
                          className={isPopped ? "" : "font-mono text-sm font-semibold text-[#34D399]"}
                        >
                          {fmt(card.marketPrice)}
                        </div>
                      ) : (
                        <div
                          style={isPopped ? { fontFamily: "monospace", fontSize: "12px", color: "#4E4E52" } : undefined}
                          className={isPopped ? "" : "font-mono text-xs text-text-dim"}
                        >
                          —
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!watching && detected.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-text-dim text-sm mb-1">Share your screen to start</div>
          <div className="text-text-dim text-xs mb-4">Cards will be identified with market prices</div>
          <div className="text-text-dim text-[10px]">Tip: use "Pop out" to float the results over your stream</div>
        </div>
      )}
    </div>
  );
}
