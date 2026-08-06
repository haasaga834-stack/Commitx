import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HourglassProps {
  size?: number;
  state?: "idle" | "running" | "success" | "failed";
  /** 0 = full top / just started, 1 = fully drained. When omitted, idle shows full top. */
  progress?: number;
  className?: string;
}

/**
 * Real-time hourglass matching the CommitX brand mark: heavy squared caps,
 * a slim charcoal frame and warm golden sand. Sand levels are driven by
 * `progress` (0..1), never by a looping animation.
 */
export function Hourglass({
  size = 200,
  state = "idle",
  progress,
  className,
}: HourglassProps) {
  const p = Math.min(1, Math.max(0, progress ?? (state === "success" ? 1 : 0)));

  const isFailed = state === "failed";
  const frame = isFailed ? "var(--color-muted-foreground)" : "var(--color-frame)";
  const sandTop = isFailed ? "var(--color-muted-foreground)" : "oklch(0.88 0.085 90)";
  const sandBottom = isFailed ? "var(--color-muted-foreground)" : "var(--color-sand)";

  const streaming = state === "running" && p > 0.0005 && p < 0.9995;

  // Chamber geometry (matches clip paths below)
  const TOP_Y = 20;
  const TOP_H = 56;
  const BOT_Y_BASE = 148;
  const BOT_H = 56;

  const topSandY = TOP_Y + TOP_H * p;
  const topSandH = TOP_H * (1 - p);
  const botSandH = BOT_H * p;
  const botSandY = BOT_Y_BASE - botSandH;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        state === "success" && "animate-soft-glow",
        (state === "idle" || state === "running") && "animate-gentle-float",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 176"
        width={size}
        height={size}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="cxSandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sandTop} />
            <stop offset="100%" stopColor={sandBottom} />
          </linearGradient>
          <clipPath id="cxTopBulb">
            <path d="M22 18 L98 18 Q98 48 62 76 L58 76 Q22 48 22 18 Z" />
          </clipPath>
          <clipPath id="cxBotBulb">
            <path d="M22 150 L98 150 Q98 120 62 92 L58 92 Q22 120 22 150 Z" />
          </clipPath>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="60" cy="166" rx="32" ry="5" fill="rgba(96,72,44,0.16)" />

        {/* Heavy squared caps */}
        <rect x="13" y="9" width="94" height="8" rx="4" fill={frame} />
        <rect x="13" y="151" width="94" height="8" rx="4" fill={frame} />

        {/* Glass silhouettes */}
        <path
          d="M22 18 L98 18 Q98 48 62 76 L62 92 Q98 120 98 150 L22 150 Q22 120 58 92 L58 76 Q22 48 22 18 Z"
          stroke={frame}
          strokeWidth="3.2"
        />

        {/* Top sand — real level */}
        {topSandH > 0.2 && (
          <g clipPath="url(#cxTopBulb)">
            <rect
              x="18"
              y={topSandY}
              width="84"
              height={topSandH + 3}
              fill="url(#cxSandGrad)"
            />
            <ellipse
              cx="60"
              cy={topSandY + 0.5}
              rx={16 * (1 - p) + 3}
              ry="2"
              fill="var(--color-background)"
              opacity="0.5"
            />
          </g>
        )}

        {/* Falling stream */}
        {streaming && <FallingStream color={sandBottom} />}

        {/* Bottom mound — real level */}
        {botSandH > 0.2 && (
          <g clipPath="url(#cxBotBulb)">
            <rect
              x="18"
              y={botSandY + 2}
              width="84"
              height={botSandH}
              fill="url(#cxSandGrad)"
            />
            <ellipse
              cx="60"
              cy={botSandY + 2}
              rx={14 + 12 * p}
              ry={3 + 2 * p}
              fill="url(#cxSandGrad)"
            />
          </g>
        )}

        {/* Neck highlight */}
        <path
          d="M58 76 L58 92"
          stroke={frame}
          strokeWidth="2.6"
          opacity="0.9"
        />
        <path
          d="M62 76 L62 92"
          stroke={frame}
          strokeWidth="2.6"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

/** Continuous grain stream through the neck (visual continuity only). */
function FallingStream({ color }: { color: string }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const grains = [0, 0.2, 0.4, 0.6, 0.8];
  const period = 0.9;
  const yStart = 84;
  const yEnd = 142;

  return (
    <g>
      <rect x="59.4" y="84" width="1.2" height="58" fill={color} opacity="0.5" />
      {grains.map((phase, i) => {
        const local = (t / period + phase) % 1;
        const y = yStart + (yEnd - yStart) * local;
        const opacity = local < 0.08 ? local / 0.08 : local > 0.92 ? (1 - local) / 0.08 : 1;
        return (
          <circle key={i} cx="60" cy={y} r="1.1" fill={color} opacity={0.9 * opacity} />
        );
      })}
    </g>
  );
}
