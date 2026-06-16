"use client";

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "#059669",
  negativeColor = "#DC2626",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  negativeColor?: string;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="bg-bg-surface rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? color : negativeColor;

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
