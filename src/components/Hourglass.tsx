import { cn } from "@/lib/utils";

interface HourglassProps {
  size?: number;
  state?: "idle" | "running" | "success" | "failed";
  className?: string;
}

/**
 * Minimalist hourglass — the CommitX identity.
 * Thin outline, elegant proportions, continuous falling sand.
 */
export function Hourglass({ size = 200, state = "idle", className }: HourglassProps) {
  const stroke =
    state === "failed"
      ? "var(--color-muted-foreground)"
      : "var(--color-foreground)";
  const sandColor =
    state === "failed" ? "var(--color-muted-foreground)" : "var(--color-sand)";

  const paused = state === "success" || state === "failed";

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
        viewBox="0 0 120 160"
        width={size}
        height={size}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Top & bottom caps */}
        <line x1="18" y1="10" x2="102" y2="10" stroke={stroke} strokeWidth="2.5" />
        <line x1="18" y1="150" x2="102" y2="150" stroke={stroke} strokeWidth="2.5" />

        {/* Frame */}
        <path
          d="M28 10 L28 30 Q28 46 52 66 Q60 72 60 78 Q60 84 52 90 Q28 110 28 130 L28 150"
          stroke={stroke}
          strokeWidth="1.6"
        />
        <path
          d="M92 10 L92 30 Q92 46 68 66 Q60 72 60 78 Q60 84 68 90 Q92 110 92 130 L92 150"
          stroke={stroke}
          strokeWidth="1.6"
        />

        {/* Sand clip regions */}
        <defs>
          <clipPath id="topBulb">
            <path d="M30 12 L30 30 Q30 44 52 64 Q60 70 60 76 Q60 70 68 64 Q90 44 90 30 L90 12 Z" />
          </clipPath>
          <clipPath id="botBulb">
            <path d="M30 148 L30 130 Q30 116 52 96 Q60 90 60 84 Q60 90 68 96 Q90 116 90 130 L90 148 Z" />
          </clipPath>
        </defs>

        {/* Top sand — shrinks slowly (visual only) */}
        <g clipPath="url(#topBulb)">
          <rect x="24" y="14" width="72" height="44" fill={sandColor} opacity="0.85" />
        </g>

        {/* Falling stream */}
        {!paused && (
          <g>
            <rect
              x="59"
              y="72"
              width="2"
              height="12"
              fill={sandColor}
              style={{
                transformOrigin: "60px 72px",
                animation: "sand-fall 1.2s linear infinite",
              }}
            />
            <rect
              x="59"
              y="72"
              width="2"
              height="10"
              fill={sandColor}
              opacity="0.6"
              style={{
                transformOrigin: "60px 72px",
                animation: "sand-fall 1.2s linear infinite",
                animationDelay: "0.6s",
              }}
            />
          </g>
        )}

        {/* Bottom mound */}
        <g clipPath="url(#botBulb)">
          <ellipse
            cx="60"
            cy="146"
            rx="28"
            ry="10"
            fill={sandColor}
            opacity="0.9"
            style={{
              transformOrigin: "60px 146px",
              animation: paused ? "none" : "sand-mound 2.4s ease-in-out infinite",
            }}
          />
          <rect x="32" y="140" width="56" height="10" fill={sandColor} opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
