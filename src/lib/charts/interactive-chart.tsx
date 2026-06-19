"use client";

import { useRef, useEffect, useState, useCallback } from "react";

type DataPoint = { value: number; label: string };

export function InteractiveChart({
  data,
  height = 120,
  color = "#059669",
  negativeColor = "#DC2626",
  formatValue,
  dark = false,
}: {
  data: DataPoint[];
  height?: number;
  color?: string;
  negativeColor?: string;
  formatValue?: (n: number) => string;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const fmt = formatValue ?? ((n: number) => n.toLocaleString("en-GB", { style: "currency", currency: "GBP" }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const handleInteraction = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el || data.length < 2) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(pct * (data.length - 1));
    setHoverIdx(idx);
  }, [data.length]);

  if (data.length < 2) {
    return <div ref={containerRef} style={{ height }} className="w-full bg-bg-surface rounded-xl" />;
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartLeft = 0;
  const chartRight = width;
  const chartTop = 8;
  const chartBottom = height - 24; // Leave room for labels
  const chartH = chartBottom - chartTop;

  const getX = (i: number) => chartLeft + (i / (data.length - 1)) * (chartRight - chartLeft);
  const getY = (v: number) => chartTop + (1 - (v - min) / range) * chartH;

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const isUp = values[values.length - 1] >= values[0];
  const strokeColor = isUp ? color : negativeColor;

  // Fill area under the line
  const areaPoints = [
    `${getX(0)},${chartBottom}`,
    ...points,
    `${getX(data.length - 1)},${chartBottom}`,
  ].join(" ");

  // X-axis labels — show ~5 evenly spaced
  const labelCount = Math.min(5, data.length);
  const labelIndices: number[] = [];
  for (let i = 0; i < labelCount; i++) {
    labelIndices.push(Math.round((i / (labelCount - 1)) * (data.length - 1)));
  }

  // Hover point
  const hoverPoint = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? getX(hoverIdx) : 0;
  const hoverY = hoverIdx != null ? getY(data[hoverIdx].value) : 0;

  const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const hoverLineColor = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";
  const labelColor = dark ? "rgba(255,255,255,0.4)" : "#9CA3AF";
  const fillOpacity = dark ? 0.15 : 0.06;

  return (
    <div ref={containerRef} className="w-full relative select-none">
      {/* Hover tooltip */}
      {hoverPoint && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: Math.min(Math.max(hoverX, 50), width - 50),
            top: -4,
            transform: "translateX(-50%)",
          }}
        >
          <div className={`text-xs font-mono px-2 py-1 rounded-lg whitespace-nowrap ${
            dark ? "bg-white text-[#1A1A2E]" : "bg-text text-bg"
          }`}>
            {fmt(hoverPoint.value)}
            <div className="text-[10px] opacity-70 text-center">{hoverPoint.label}</div>
          </div>
        </div>
      )}

      <svg
        width={width}
        height={height}
        className="block w-full cursor-crosshair"
        onMouseMove={(e) => handleInteraction(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={(e) => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = chartTop + (1 - pct) * chartH;
          return (
            <line key={pct} x1={chartLeft} y1={y} x2={chartRight} y2={y}
              stroke={gridColor} strokeWidth="1" />
          );
        })}

        {/* Fill area */}
        <polygon points={areaPoints} fill={strokeColor} opacity={fillOpacity} />

        {/* Line */}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical line + dot */}
        {hoverIdx != null && (
          <>
            <line x1={hoverX} y1={chartTop} x2={hoverX} y2={chartBottom}
              stroke={hoverLineColor} strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={hoverX} cy={hoverY} r="4" fill={strokeColor} stroke={dark ? "#1A1A2E" : "white"} strokeWidth="2" />
          </>
        )}

        {/* X-axis labels */}
        {labelIndices.map((idx) => (
          <text
            key={idx}
            x={getX(idx)}
            y={height - 4}
            textAnchor="middle"
            className="text-[10px]"
            fill={labelColor}
          >
            {data[idx].label}
          </text>
        ))}

        {/* Y-axis min/max */}
        <text x={4} y={chartTop + 10} className="text-[10px]" fill={labelColor}>{fmt(max)}</text>
        <text x={4} y={chartBottom - 2} className="text-[10px]" fill={labelColor}>{fmt(min)}</text>
      </svg>
    </div>
  );
}
