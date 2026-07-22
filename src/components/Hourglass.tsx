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
 * Real-time hourglass. Sand levels are driven by `progress` (0..1),
 * not by a looping animation. The falling stream is continuous but
 * the chamber fills are proportional to elapsed time.
 */
export function Hourglass({
  size = 200,
  state = "idle",
  progress,
  className,
}: HourglassProps) {
  const p = Math.min(1, Math.max(0, progress ?? (state === "success" ? 1 : 0)));

  const isFailed = state === "failed";
  const frame = isFailed ? "var(--color-muted-foreground)" : "var(--color-foreground)";
  const sand = isFailed ? "var(--color-muted-foreground)" : "var(--color-sand)";
  const glass = "rgba(255,255,255,0.55)";

  const streaming = state === "running" && p > 0.0005 && p < 0.9995;

  // Chamber geometry (matches clipPaths below)
  const TOP_Y = 14;      // top of top chamber sand area
  const TOP_H = 50;      // usable sand height in top chamber
  const BOT_Y_BASE = 148;// bottom of bottom chamber
  const BOT_H = 50;      // usable sand height in bottom chamber

  // Top sand: rectangle whose top edge drops as p grows.
  const topSandY = TOP_Y + TOP_H * p;
  const topSandH = TOP_H * (1 - p);

  // Bottom sand: rectangle whose top edge rises as p grows.
  const botSandH = BOT_H * p;
  const botSandY = BOT_Y_BASE - botSandH;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        state === "success" && "animate-soft-glow",
        state === "idle" && "animate-gentle-float",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 170"
        width={size}
        height={size}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          {/* Sand gradient — warm gold */}
          <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sand} stopOpacity="1" />
            <stop offset="100%" stopColor={sand} stopOpacity="0.85" />
          </linearGradient>
          {/* Glass sheen */}
          <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={glass} stopOpacity="0.55" />
            <stop offset="55%" stopColor={glass} stopOpacity="0.08" />
            <stop offset="100%" stopColor={glass} stopOpacity="0.28" />
          </linearGradient>
          {/* Bulb clip regions */}
          <clipPath id="topBulb">
            <path d="M30 12 L30 30 Q30 46 52 66 Q60 72 60 76 Q60 70 68 66 Q90 46 90 30 L90 12 Z" />
          </clipPath>
          <clipPath id="botBulb">
            <path d="M30 148 L30 130 Q30 114 52 94 Q60 88 60 84 Q60 90 68 94 Q90 114 90 130 L90 148 Z" />
          </clipPath>
        </defs>

        {/* Soft ground shadow */}
        <ellipse
          cx="60"
          cy="162"
          rx="34"
          ry="3.5"
          fill="rgba(16,24,40,0.14)"
        />

        {/* Caps */}
        <line x1="16" y1="10" x2="104" y2="10" stroke={frame} strokeWidth="3" />
        <line x1="16" y1="150" x2="104" y2="150" stroke={frame} strokeWidth="3" />

        {/* Frame silhouettes */}
        <path
          d="M28 10 L28 30 Q28 46 52 66 Q60 72 60 78 Q60 84 52 90 Q28 110 28 130 L28 150"
          stroke={frame}
          strokeWidth="1.8"
        />
        <path
          d="M92 10 L92 30 Q92 46 68 66 Q60 72 60 78 Q60 84 68 90 Q92 110 92 130 L92 150"
          stroke={frame}
          strokeWidth="1.8"
        />

        {/* Glass sheen inside bulbs */}
        <g clipPath="url(#topBulb)" opacity="0.9">
          <rect x="24" y="10" width="72" height="60" fill="url(#glassGrad)" />
        </g>
        <g clipPath="url(#botBulb)" opacity="0.9">
          <rect x="24" y="90" width="72" height="60" fill="url(#glassGrad)" />
        </g>

        {/* Top sand — real level */}
        {topSandH > 0.2 && (
          <g clipPath="url(#topBulb)">
            <rect
              x="24"
              y={topSandY}
              width="72"
              height={topSandH + 2}
              fill="url(#sandGrad)"
            />
            {/* subtle concave dip at surface where sand feeds funnel */}
            <ellipse
              cx="60"
              cy={topSandY + 0.5}
              rx={14 * (1 - p) + 4}
              ry="2.2"
              fill="var(--color-background)"
              opacity="0.55"
            />
          </g>
        )}

        {/* Falling stream — real, continuous, only while running */}
        {streaming && <FallingStream color={sand} />}

        {/* Bottom mound — real level with rounded top */}
        {botSandH > 0.2 && (
          <g clipPath="url(#botBulb)">
            <rect
              x="24"
              y={botSandY + 2}
              width="72"
              height={botSandH}
              fill="url(#sandGrad)"
            />
            <ellipse
              cx="60"
              cy={botSandY + 2}
              rx={16 + 10 * p}
              ry={3 + 2 * p}
              fill="url(#sandGrad)"
            />
          </g>
        )}

        {/* Highlight rim on glass */}
        <path
          d="M32 14 Q30 30 34 44"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.8"
          opacity="0.7"
        />
        <path
          d="M32 100 Q30 120 34 140"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.8"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

/**
 * Continuous stream of grains through the neck. Uses rAF for smooth
 * 60fps motion; the *chamber levels* are the source of truth for
 * elapsed time — the stream is purely visual continuity.
 */
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

  // 5 grains at staggered phases, falling from y=76 to y=~140
  const grains = [0, 0.2, 0.4, 0.6, 0.8];
  const period = 0.9; // seconds per grain traversal
  const yStart = 76;
  const yEnd = 138;

  return (
    <g>
      {/* thin continuous thread */}
      <rect x="59.4" y="76" width="1.2" height="60" fill={color} opacity="0.55" />
      {grains.map((phase, i) => {
        const local = ((t / period + phase) % 1);
        const y = yStart + (yEnd - yStart) * local;
        const opacity = local < 0.08 ? local / 0.08 : local > 0.92 ? (1 - local) / 0.08 : 1;
        return (
          <circle
            key={i}
            cx="60"
            cy={y}
            r="1.1"
            fill={color}
            opacity={0.9 * opacity}
          />
        );
      })}
    </g>
  );
}
