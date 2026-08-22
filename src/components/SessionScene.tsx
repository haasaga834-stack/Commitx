import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { WindScape } from "@/components/WindScape";
import { normalizeTheme, type SessionThemeId } from "@/lib/session-themes";

/**
 * Ambient backdrop for a session. Every scene is decorative only: it reads
 * `progress` from the authoritative session clock and freezes entirely while
 * `paused` (wellness break), never driving session state itself.
 */
export function SessionScene({
  theme,
  progress = 0,
  paused = false,
  className,
}: {
  theme: SessionThemeId | string | null | undefined;
  progress?: number;
  paused?: boolean;
  className?: string;
}) {
  const id = normalizeTheme(theme);
  const p = Math.min(1, Math.max(0, progress));

  if (id === "leaves") {
    return <WindScape fixed={false} className={cn("z-0", className)} paused={paused} />;
  }

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        paused && "[&_*]:![animation-play-state:paused]",
        className,
      )}
    >
      {id === "fireflies" && <FireflyGarden />}
      {id === "tree" && <GrowingTree progress={p} />}
      {id === "moon" && <MoonlitSky />}
      {id === "lotus" && <LotusPond progress={p} />}
    </div>
  );
}

/** Small static-ish preview used inside the theme selector cards. */
export function ThemePreview({ theme }: { theme: SessionThemeId }) {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-secondary/60">
      <SessionScene theme={theme} progress={0.55} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Firefly Garden                                                      */
/* ------------------------------------------------------------------ */

function useSeeded<T>(factory: () => T) {
  // Deterministic per-mount data; avoids module-scope randomness (SSR safe).
  return useMemo(factory, []);
}

function FireflyGarden() {
  const flies = useSeeded(() =>
    Array.from({ length: 22 }, (_, i) => ({
      left: `${(i * 37) % 96 + 2}%`,
      top: `${(i * 53) % 78 + 8}%`,
      size: 3 + (i % 3),
      delay: `-${(i * 1.37) % 9}s`,
      duration: `${9 + ((i * 5) % 8)}s`,
      glow: `${2.2 + ((i * 3) % 5) * 0.4}s`,
    })),
  );

  return (
    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,oklch(0.28_0.04_170)_0%,oklch(0.19_0.03_170)_55%,oklch(0.14_0.02_170)_100%)]">
      {flies.map((f, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-firefly-drift"
          style={{
            left: f.left,
            top: f.top,
            width: f.size,
            height: f.size,
            animationDelay: f.delay,
            animationDuration: f.duration,
            background: "oklch(0.95 0.14 100)",
            boxShadow: "0 0 10px 3px oklch(0.9 0.14 100 / 0.55)",
          }}
        >
          <span
            className="absolute inset-0 rounded-full animate-firefly-glow"
            style={{ animationDuration: f.glow, background: "inherit" }}
          />
        </span>
      ))}
      {/* Garden silhouette */}
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 h-[26%] w-full"
      >
        <path
          d="M0 120 L0 74 Q40 58 78 70 Q120 44 168 66 Q214 48 258 68 Q306 52 348 70 Q376 62 400 76 L400 120 Z"
          fill="oklch(0.16 0.03 165)"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Growing Tree                                                        */
/* ------------------------------------------------------------------ */

function GrowingTree({ progress }: { progress: number }) {
  // Canopy grows smoothly with real progress; no independent animation state.
  const grow = 0.28 + 0.72 * progress;
  return (
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.96_0.02_120)_0%,oklch(0.93_0.03_120)_60%,oklch(0.9_0.04_120)_100%)] dark:bg-[linear-gradient(to_bottom,oklch(0.22_0.02_150)_0%,oklch(0.18_0.02_150)_100%)]">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYEnd slice"
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
      >
        <ellipse cx="200" cy="248" rx="120" ry="9" fill="oklch(0.72 0.05 120 / 0.35)" />
        <g
          style={{
            transform: `translate(200px, 248px) scale(${grow}) translate(-200px, -248px)`,
            transformOrigin: "200px 248px",
            transition: "transform 600ms linear",
          }}
        >
          <path
            d="M197 248 L197 160 Q188 140 176 128 M203 248 L203 150 Q214 132 228 122 M200 200 Q186 186 172 178 M200 176 Q216 164 230 158"
            stroke="oklch(0.42 0.05 60)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <g className="animate-canopy-sway" style={{ transformOrigin: "200px 150px" }}>
            <circle cx="200" cy="118" r="46" fill="oklch(0.68 0.13 145 / 0.85)" />
            <circle cx="164" cy="140" r="30" fill="oklch(0.62 0.13 150 / 0.8)" />
            <circle cx="238" cy="138" r="32" fill="oklch(0.72 0.12 140 / 0.8)" />
            <circle cx="200" cy="88" r="26" fill="oklch(0.76 0.12 135 / 0.75)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moonlit Sky                                                         */
/* ------------------------------------------------------------------ */

function MoonlitSky() {
  const stars = useSeeded(() =>
    Array.from({ length: 34 }, (_, i) => ({
      left: `${(i * 29) % 98 + 1}%`,
      top: `${(i * 41) % 70 + 2}%`,
      size: 1 + (i % 3) * 0.8,
      duration: `${3 + ((i * 7) % 6)}s`,
      delay: `-${(i * 0.9) % 6}s`,
    })),
  );

  return (
    <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_70%_10%,oklch(0.34_0.05_255)_0%,oklch(0.22_0.05_265)_55%,oklch(0.15_0.04_265)_100%)]">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-star-twinkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}
      <div
        className="absolute right-[14%] top-[10%] h-20 w-20 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 35%, #fdf6df 0%, #f2e6bd 60%, #e6d7a8 100%)",
          boxShadow: "0 0 60px 18px rgba(253,246,223,0.28)",
        }}
      />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute animate-cloud-drift rounded-full"
          style={{
            top: `${18 + i * 16}%`,
            width: `${180 + i * 70}px`,
            height: `${34 + i * 8}px`,
            background: "oklch(0.85 0.02 260 / 0.14)",
            filter: "blur(10px)",
            animationDuration: `${120 + i * 55}s`,
            animationDelay: `-${i * 30}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lotus Pond                                                          */
/* ------------------------------------------------------------------ */

function LotusPond({ progress }: { progress: number }) {
  // Petals open gradually as the session progresses.
  const open = 0.25 + 0.75 * progress;
  const petals = [-72, -46, -22, 0, 22, 46, 72];
  return (
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.94_0.03_200)_0%,oklch(0.86_0.05_205)_55%,oklch(0.72_0.07_215)_100%)] dark:bg-[linear-gradient(to_bottom,oklch(0.24_0.03_215)_0%,oklch(0.17_0.03_220)_100%)]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute left-1/2 bottom-[16%] -translate-x-1/2 rounded-full border animate-ripple-out"
          style={{
            width: 60,
            height: 22,
            borderColor: "oklch(0.98 0.01 210 / 0.35)",
            animationDuration: "7s",
            animationDelay: `-${i * 2.3}s`,
          }}
        />
      ))}
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYEnd slice"
        className="absolute inset-x-0 bottom-0 h-[48%] w-full"
      >
        <ellipse cx="118" cy="176" rx="40" ry="11" fill="oklch(0.55 0.11 150 / 0.6)" />
        <ellipse cx="292" cy="160" rx="32" ry="9" fill="oklch(0.5 0.1 150 / 0.55)" />
        <g style={{ transform: "translate(200px,168px)" }}>
          {petals.map((deg) => (
            <ellipse
              key={deg}
              cx="0"
              cy="-24"
              rx="11"
              ry="30"
              fill="oklch(0.9 0.07 350 / 0.9)"
              stroke="oklch(0.82 0.1 345 / 0.7)"
              style={{
                transform: `rotate(${deg * open}deg)`,
                transformOrigin: "0px 0px",
                transition: "transform 700ms linear",
              }}
            />
          ))}
          <circle cx="0" cy="-18" r="7" fill="oklch(0.92 0.12 95)" />
        </g>
      </svg>
    </div>
  );
}
