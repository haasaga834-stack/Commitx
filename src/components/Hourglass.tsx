import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HourglassProps {
  /** Max rendered width in px. The glass scales down fluidly on narrow screens. */
  size?: number;
  state?: "idle" | "running" | "success" | "failed";
  /** 0 = full top / just started, 1 = fully drained. Driven by real elapsed time. */
  progress?: number;
  className?: string;
}

/* Chamber geometry (viewBox 0 0 200 300) */
const NECK_Y = 150;
const TOP_INNER_Y = 26;
const BOT_INNER_Y = 274;
const TOP_H = NECK_Y - TOP_INNER_Y;
const BOT_H = BOT_INNER_Y - NECK_Y;

/** Convert a volume fraction to a height fraction for a cone-ish chamber. */
const volumeToHeight = (v: number, k: number) => Math.pow(Math.min(1, Math.max(0, v)), 1 / k);

/**
 * Physical hourglass: matte dark frame, real glass, warm golden sand.
 * Sand levels are a pure function of `progress` (real elapsed time), so the
 * render is always correct after lock/unlock, background/foreground or reload.
 */
export function Hourglass({ size = 200, state = "idle", progress, className }: HourglassProps) {
  const p = Math.min(1, Math.max(0, progress ?? (state === "success" ? 1 : 0)));

  const failed = state === "failed";
  const frame = failed ? "var(--color-muted-foreground)" : "var(--color-foreground)";
  const uid = useRef(`hg${Math.random().toString(36).slice(2, 8)}`).current;

  // Top chamber: emptying from a wide-top cone → height falls slower than volume.
  const topH = TOP_H * volumeToHeight(1 - p, 1.9);
  const topSurfaceY = NECK_Y - topH;
  // Bottom chamber: mound grows from a wide base.
  const botH = BOT_H * volumeToHeight(p, 1.55);
  const moundY = BOT_INNER_Y - botH;

  const streaming = state === "running" && p > 0.0004 && p < 0.9996;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        state === "success" && "animate-soft-glow",
        state === "idle" && "animate-gentle-float",
        className,
      )}
      style={{ width: "100%", maxWidth: size }}
    >
      <svg viewBox="0 0 200 300" width="100%" height="auto" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-sand`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={failed ? "oklch(0.74 0 0)" : "oklch(0.90 0.09 88)"} />
            <stop offset="55%" stopColor={failed ? "oklch(0.66 0 0)" : "oklch(0.82 0.13 82)"} />
            <stop offset="100%" stopColor={failed ? "oklch(0.58 0 0)" : "oklch(0.72 0.13 72)"} />
          </linearGradient>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.30" />
            <stop offset="22%" stopColor="oklch(1 0 0)" stopOpacity="0.06" />
            <stop offset="70%" stopColor="oklch(1 0 0)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="oklch(1 0 0)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={frame} stopOpacity="0.92" />
            <stop offset="100%" stopColor={frame} stopOpacity="1" />
          </linearGradient>
          <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="oklch(0.2 0.02 250)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="oklch(0.2 0.02 250)" stopOpacity="0" />
          </radialGradient>

          <clipPath id={`${uid}-top`}>
            <path d="M34 26 C34 92 96 128 96 150 L104 150 C104 128 166 92 166 26 Z" />
          </clipPath>
          <clipPath id={`${uid}-bot`}>
            <path d="M34 274 C34 208 96 172 96 150 L104 150 C104 172 166 208 166 274 Z" />
          </clipPath>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="100" cy="294" rx="66" ry="10" fill={`url(#${uid}-shadow)`} />

        {/* Glass body */}
        <path
          d="M34 26 C34 92 96 128 96 150 C96 172 34 208 34 274 L166 274 C166 208 104 172 104 150 C104 128 166 92 166 26 Z"
          fill={`url(#${uid}-glass)`}
        />

        {/* Top sand — real level */}
        {topH > 0.4 && (
          <g clipPath={`url(#${uid}-top)`}>
            <rect x="28" y={topSurfaceY} width="144" height={topH + 4} fill={`url(#${uid}-sand)`} />
            {/* concave funnel dip at the surface */}
            <path
              d={`M28 ${topSurfaceY - 1} L172 ${topSurfaceY - 1} L172 ${topSurfaceY + 9} Q100 ${
                topSurfaceY + 9 + 12 * (1 - p)
              } 28 ${topSurfaceY + 9} Z`}
              fill="var(--color-background)"
              opacity="0.55"
            />
          </g>
        )}

        {/* Falling stream */}
        {streaming && <FallingStream uid={uid} moundY={moundY} />}

        {/* Bottom mound — real level */}
        {botH > 0.4 && (
          <g clipPath={`url(#${uid}-bot)`}>
            <path
              d={`M28 ${BOT_INNER_Y + 4} L28 ${moundY + 14} Q100 ${moundY - 12} 172 ${
                moundY + 14
              } L172 ${BOT_INNER_Y + 4} Z`}
              fill={`url(#${uid}-sand)`}
            />
            <path
              d={`M28 ${moundY + 14} Q100 ${moundY - 12} 172 ${moundY + 14}`}
              stroke="oklch(1 0 0)"
              strokeOpacity="0.28"
              strokeWidth="1.4"
              fill="none"
            />
          </g>
        )}

        {/* Glass outline + specular highlights */}
        <path
          d="M34 26 C34 92 96 128 96 150 C96 172 34 208 34 274 L166 274 C166 208 104 172 104 150 C104 128 166 92 166 26 Z"
          stroke={frame}
          strokeOpacity="0.85"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M46 34 C47 88 92 126 92 150 C92 174 47 212 46 266"
          stroke="oklch(1 0 0)"
          strokeOpacity="0.35"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M154 40 C153 86 116 122 114 148"
          stroke="oklch(1 0 0)"
          strokeOpacity="0.18"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Matte caps */}
        <rect x="18" y="8" width="164" height="18" rx="9" fill={`url(#${uid}-cap)`} />
        <rect x="18" y="274" width="164" height="18" rx="9" fill={`url(#${uid}-cap)`} />
        <rect x="26" y="11" width="148" height="4" rx="2" fill="oklch(1 0 0)" opacity="0.18" />
      </svg>
    </div>
  );
}

/** Continuous grain stream through the neck — visual continuity only. */
function FallingStream({ uid, moundY }: { uid: string; moundY: number }) {
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

  const yStart = 152;
  const yEnd = Math.max(yStart + 8, moundY + 6);
  const span = yEnd - yStart;
  const grains = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84];
  const period = 0.62;

  return (
    <g clipPath={`url(#${uid}-bot)`}>
      <rect x="99.1" y={yStart} width="1.8" height={span} fill={`url(#${uid}-sand)`} opacity="0.55" />
      {grains.map((phase, i) => {
        const local = (t / period + phase) % 1;
        // gravity: distance grows quadratically over the fall
        const y = yStart + span * (local * local);
        const fade = local > 0.9 ? (1 - local) / 0.1 : 1;
        return (
          <circle
            key={i}
            cx={100 + (i % 2 === 0 ? 0.9 : -0.9) * Math.sin(local * 6)}
            cy={y}
            r={1.15}
            fill={`url(#${uid}-sand)`}
            opacity={0.95 * fade}
          />
        );
      })}
      {/* impact dust at the mound */}
      <ellipse cx="100" cy={yEnd} rx={5 + 2 * Math.sin(t * 6)} ry="1.6" fill={`url(#${uid}-sand)`} opacity="0.4" />
    </g>
  );
}
