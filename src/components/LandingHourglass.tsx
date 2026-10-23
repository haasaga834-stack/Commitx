import { useEffect, useRef, useState } from "react";

/**
 * Purely decorative hero hourglass for the public landing page.
 * Self-contained: a lightweight 1s tick drives sand levels and the countdown.
 * No session logic, no data — presentation only.
 */
export function LandingHourglass({
  size = 300,
  loopSeconds = 60,
  totalMinutes = 50,
  showTimer = true,
  className = "",
}: {
  size?: number;
  loopSeconds?: number;
  totalMinutes?: number;
  showTimer?: boolean;
  className?: string;
}) {
  const [p, setP] = useState(0.18);
  const start = useRef<number>(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    start.current = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - start.current) / 1000;
      setP(((elapsed / loopSeconds) % 1 + 0.18) % 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [loopSeconds]);

  const TOP_Y = 20;
  const TOP_H = 56;
  const BOT_Y = 148;
  const BOT_H = 56;
  const topFill = 1 - p;
  const topSandH = TOP_H * topFill;
  const topSandY = TOP_Y + TOP_H - topSandH;
  const botSandH = BOT_H * p;
  const botSandY = BOT_Y - botSandH;

  const remaining = Math.max(0, Math.round(totalMinutes * 60 * (1 - p)));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const circ = 2 * Math.PI * 92;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* ambient glow */}
      <div
        className="animate-sun-breathe absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, oklch(0.86 0.09 88 / 0.55), transparent 68%)",
        }}
      />

      {/* progress ring */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.10"
          strokeWidth="1.5"
        />
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="oklch(0.5 0.11 150)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - p)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>

      <div className="animate-gentle-float relative flex h-full w-full items-center justify-center">
        <svg
          viewBox="0 0 120 176"
          className="h-[74%] w-[74%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="lhSand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.9 0.08 90)" />
              <stop offset="100%" stopColor="oklch(0.76 0.115 78)" />
            </linearGradient>
            <linearGradient id="lhGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
            </linearGradient>
            <clipPath id="lhTop">
              <path d="M25 19.8 L95 19.8 Q94.5 47.5 61 74.5 L59 74.5 Q25.5 47.5 25 19.8 Z" />
            </clipPath>
            <clipPath id="lhBot">
              <path d="M25 148.2 L95 148.2 Q94.5 120.5 61 93.5 L59 93.5 Q25.5 120.5 25 148.2 Z" />
            </clipPath>
          </defs>

          <ellipse cx="60" cy="167" rx="30" ry="4" fill="currentColor" opacity="0.10" />

          {/* glass body */}
          <path
            d="M22 18 L98 18 Q98 48 62 76 L62 92 Q98 120 98 150 L22 150 Q22 120 58 92 L58 76 Q22 48 22 18 Z"
            fill="url(#lhGlass)"
          />

          <rect x="13" y="9" width="94" height="8" rx="4" fill="currentColor" opacity="0.85" />
          <rect x="13" y="151" width="94" height="8" rx="4" fill="currentColor" opacity="0.85" />

          <path
            d="M22 18 L98 18 Q98 48 62 76 L62 92 Q98 120 98 150 L22 150 Q22 120 58 92 L58 76 Q22 48 22 18 Z"
            stroke="currentColor"
            strokeOpacity="0.75"
            strokeWidth="2.6"
          />

          {topSandH > 0.3 && (
            <g clipPath="url(#lhTop)">
              <rect
                x="18"
                width="84"
                y={topSandY}
                height={topSandH + 3}
                fill="url(#lhSand)"
                style={{ transition: "y 1s linear, height 1s linear" }}
              />
            </g>
          )}

          {/* falling grains */}
          <g>
            <rect x="59.5" y="84" width="1" height="58" fill="oklch(0.76 0.115 78)" opacity="0.45" />
            {[0, 0.2, 0.4, 0.6, 0.8].map((d) => (
              <circle key={d} cx="60" cy="84" r="1.1" fill="oklch(0.76 0.115 78)" opacity="0">
                <animate
                  attributeName="cy"
                  values="84;142"
                  dur="0.9s"
                  begin={`-${d}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.95;0.95;0"
                  keyTimes="0;0.1;0.9;1"
                  dur="0.9s"
                  begin={`-${d}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>

          {botSandH > 0.3 && (
            <g clipPath="url(#lhBot)">
              <rect
                x="18"
                width="84"
                y={botSandY + 2}
                height={botSandH}
                fill="url(#lhSand)"
                style={{ transition: "y 1s linear, height 1s linear" }}
              />
              <ellipse
                cx="60"
                cy={botSandY + 2}
                rx={14 + 12 * p}
                ry={3 + 2 * p}
                fill="url(#lhSand)"
              />
            </g>
          )}

          {/* glass highlight */}
          <path d="M31 24 Q34 46 52 66" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
        </svg>

        {showTimer ? (
          <span className="pointer-events-none absolute bottom-[2%] rounded-full border border-current/10 bg-white/70 px-3 py-1 text-[11px] font-medium tabular-nums backdrop-blur-sm">
            {mm}:{ss}
          </span>
        ) : null}
      </div>
    </div>
  );
}
