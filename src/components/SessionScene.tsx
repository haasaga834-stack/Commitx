import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { WindScape } from "@/components/WindScape";
import { normalizeTheme, type SessionThemeId } from "@/lib/session-themes";

/**
 * Ambient backdrop for a session. Every scene is decorative only: it reads
 * `progress` from the authoritative session clock and freezes entirely while
 * `paused` (wellness break), never driving session state itself.
 *
 * Each scene interpolates continuously from that single progress value — there
 * are no internal timers and no abrupt stage switches, so the world simply
 * keeps deepening as the commitment is kept. The timer always stays on top:
 * scenes are low-contrast, blurred and unmounted from interaction.
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

  // Falling Leaves is intentionally untouched.
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
      {id === "fireflies" && <FireflyGarden progress={p} />}
      {id === "tree" && <GrowingPlant progress={p} />}
      {id === "moon" && <MoonlitSky progress={p} />}
      {id === "lotus" && <LotusPond progress={p} />}
    </div>
  );
}

/** Small static-ish preview used inside the theme selector cards. */
export function ThemePreview({ theme }: { theme: SessionThemeId }) {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-secondary/60">
      <SessionScene theme={theme} progress={0.68} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Continuous ramp so stages blend instead of popping in. */
const ramp = (p: number, from: number, span = 0.12) => clamp01((p - from) / span);
/** Smooth ease so growth never looks mechanical. */
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

function useSeeded<T>(factory: () => T) {
  // Deterministic per-mount data; avoids module-scope randomness (SSR safe).
  return useMemo(factory, []);
}

/* ------------------------------------------------------------------ */
/* Firefly Garden — a night garden that slowly fills with light         */
/* ------------------------------------------------------------------ */

function FireflyGarden({ progress }: { progress: number }) {
  const p = clamp01(progress);
  // Few flickers at the start, a fully illuminated garden at the end.
  const lit = ease(p);
  const active = Math.round(mix(5, 30, lit));

  const flies = useSeeded(() =>
    Array.from({ length: 30 }, (_, i) => {
      // Three depth bands: far (small, dim, slow) → near (larger, brighter).
      const depth = i % 3;
      return {
        depth,
        left: `${((i * 41) % 94) + 3}%`,
        top: `${((i * 57) % 62) + 22}%`,
        size: 2 + depth * 1.6,
        blur: depth === 0 ? 1.4 : depth === 1 ? 0.6 : 0,
        drift: `${16 - depth * 3 + ((i * 3) % 6)}s`,
        driftDelay: `-${(i * 1.9) % 18}s`,
        glow: `${3.4 + ((i * 7) % 5) * 0.55}s`,
        glowDelay: `-${(i * 1.3) % 6}s`,
      };
    }),
  );

  const stars = useSeeded(() =>
    Array.from({ length: 26 }, (_, i) => ({
      left: `${((i * 31) % 97) + 1}%`,
      top: `${((i * 23) % 40) + 2}%`,
      size: 0.8 + (i % 3) * 0.5,
      duration: `${5 + ((i * 5) % 6)}s`,
      delay: `-${(i * 1.1) % 7}s`,
    })),
  );

  const blades = useSeeded(() =>
    Array.from({ length: 34 }, (_, i) => ({
      x: (i * 12.1) % 400,
      h: 14 + ((i * 7) % 22),
      lean: ((i % 5) - 2) * 3.2,
      delay: `-${(i * 0.7) % 8}s`,
      duration: `${7 + ((i * 3) % 5)}s`,
    })),
  );

  return (
    <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_0%,oklch(0.30_0.07_285)_0%,oklch(0.21_0.06_275)_45%,oklch(0.13_0.04_270)_100%)]">
      {/* Faint stars above the treeline */}
      {stars.map((s, i) => (
        <span
          key={`s${i}`}
          className="absolute rounded-full bg-white animate-star-twinkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            opacity: 0.35 + 0.4 * lit,
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* Warm ambient bloom that deepens as the garden fills with light */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%] animate-scene-haze"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 100%, oklch(0.86 0.13 100 / 0.22) 0%, transparent 70%)",
          opacity: 0.25 + 0.75 * lit,
        }}
      />

      {/* Fireflies, appearing gradually and sorted into depth bands */}
      {flies.map((f, i) => {
        const on = clamp01((active - i) / 3);
        if (on <= 0.02) return null;
        return (
          <span
            key={`f${i}`}
            className="absolute animate-firefly-drift"
            style={{
              left: f.left,
              top: f.top,
              animationDuration: f.drift,
              animationDelay: f.driftDelay,
              filter: f.blur ? `blur(${f.blur}px)` : undefined,
              opacity: on * (0.45 + 0.2 * f.depth),
              transition: "opacity 1200ms linear",
            }}
          >
            <span
              className="block rounded-full animate-firefly-glow"
              style={{
                width: f.size,
                height: f.size,
                background: "oklch(0.96 0.13 102)",
                boxShadow: `0 0 ${6 + f.depth * 5}px ${1 + f.depth}px oklch(0.9 0.14 100 / 0.5)`,
                animationDuration: f.glow,
                animationDelay: f.glowDelay,
              }}
            />
          </span>
        );
      })}

      {/* Distant silhouettes: treeline, then hedges, then foreground grass */}
      <svg
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[34%] w-full"
      >
        <path
          d="M0 160 L0 88 Q26 58 46 74 Q64 40 88 66 Q112 34 138 64 Q166 44 192 70 Q220 38 248 66 Q276 48 302 70 Q330 46 356 68 Q380 58 400 78 L400 160 Z"
          fill="oklch(0.18 0.05 275)"
          opacity="0.85"
        />
        <path
          d="M0 160 L0 116 Q44 100 84 112 Q126 94 170 110 Q214 96 258 112 Q304 98 348 114 Q376 106 400 118 L400 160 Z"
          fill="oklch(0.14 0.04 272)"
        />
        <g className="animate-canopy-sway" style={{ transformOrigin: "200px 160px" }}>
          {blades.map((b, i) => (
            <path
              key={`g${i}`}
              d={`M${b.x} 160 Q ${b.x + b.lean} ${160 - b.h * 0.6} ${b.x + b.lean * 2} ${160 - b.h}`}
              stroke="oklch(0.22 0.06 160)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
              style={{ animationDelay: b.delay, animationDuration: b.duration }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Growing Plant — seed → sprout → young → growing → mature            */
/* ------------------------------------------------------------------ */

const SOIL_Y = 250;

function GrowingPlant({ progress }: { progress: number }) {
  const p = clamp01(progress);
  const g = ease(p);

  // One continuous growth curve drives stem, leaves, bud and bloom.
  const stemH = mix(6, 182, g);
  const tipY = SOIL_Y - stemH;
  const stemW = mix(1.8, 5.4, g);
  const lean = mix(0, 9, g);

  const seed = 1 - ramp(p, 0.02, 0.1);
  const bud = ramp(p, 0.62, 0.18);
  const bloom = ramp(p, 0.8, 0.2);

  // Alternating leaf pairs unfurl up the stem, each a little later.
  const leaves = Array.from({ length: 10 }, (_, i) => {
    const at = 0.05 + i * 0.075;
    const grow = ease(ramp(p, at, 0.16));
    const along = 0.16 + (i / 10) * 0.76;
    return {
      key: i,
      grow,
      y: SOIL_Y - stemH * along,
      x: 200 + lean * along * 0.55,
      side: i % 2 === 0 ? 1 : -1,
      // Fuller near the middle of the stem, tapering towards soil and tip.
      len: mix(20, 44, 1 - Math.abs(0.48 - along) * 1.35),
      droop: 12 + (i % 3) * 6,
    };
  });

  const pebbles = useSeeded(() =>
    Array.from({ length: 9 }, (_, i) => ({
      cx: 130 + ((i * 37) % 145),
      cy: SOIL_Y + 1 + ((i * 5) % 7),
      rx: 2 + (i % 3) * 0.9,
      tone: 0.38 + (i % 4) * 0.05,
    })),
  );

  const motes = useSeeded(() =>
    Array.from({ length: 10 }, (_, i) => ({
      left: `${((i * 37) % 80) + 10}%`,
      top: `${((i * 29) % 52) + 18}%`,
      size: 2 + (i % 3),
      duration: `${13 + ((i * 3) % 7)}s`,
      delay: `-${(i * 1.7) % 12}s`,
    })),
  );

  return (
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.97_0.02_110)_0%,oklch(0.94_0.035_120)_52%,oklch(0.9_0.05_128)_100%)] dark:bg-[linear-gradient(to_bottom,oklch(0.24_0.02_150)_0%,oklch(0.17_0.02_155)_100%)]">
      {/* Soft directional daylight */}
      <div
        className="absolute inset-0 animate-sun-breathe"
        style={{
          background:
            "radial-gradient(70% 55% at 22% 8%, oklch(0.99 0.05 95 / 0.45) 0%, transparent 62%)",
        }}
      />
      {/* Drifting pollen in the light */}
      {motes.map((m, i) => (
        <span
          key={`m${i}`}
          className="absolute rounded-full animate-gentle-float"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            background: "oklch(0.98 0.05 100 / 0.6)",
            animationDuration: m.duration,
            animationDelay: m.delay,
            opacity: 0.3 + 0.5 * g,
          }}
        />
      ))}

      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYEnd slice"
        className="absolute inset-x-0 bottom-0 h-[66%] w-full"
      >
        <defs>
          <linearGradient id="cxStem" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.44 0.1 135)" />
            <stop offset="100%" stopColor="oklch(0.62 0.14 140)" />
          </linearGradient>
          <linearGradient id="cxLeaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.68 0.14 145)" />
            <stop offset="100%" stopColor="oklch(0.48 0.12 152)" />
          </linearGradient>
          <linearGradient id="cxSoil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.44 0.06 55)" />
            <stop offset="100%" stopColor="oklch(0.3 0.05 50)" />
          </linearGradient>
        </defs>

        {/* Soil mound with a soft shadow and a few pebbles */}
        <ellipse cx="200" cy={SOIL_Y + 6} rx="150" ry="16" fill="oklch(0.55 0.04 60 / 0.22)" />
        <path
          d={`M46 ${SOIL_Y + 22} Q 120 ${SOIL_Y - 12} 200 ${SOIL_Y - 9} Q 282 ${SOIL_Y - 12} 354 ${SOIL_Y + 22} Z`}
          fill="url(#cxSoil)"
        />
        {pebbles.map((s, i) => (
          <ellipse
            key={`p${i}`}
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.rx * 0.62}
            fill={`oklch(${s.tone} 0.03 60 / 0.75)`}
          />
        ))}

        {/* Grass tufts around the base */}
        {[-64, -44, -26, 26, 46, 66].map((dx, i) => (
          <path
            key={`t${i}`}
            d={`M${200 + dx} ${SOIL_Y - 4} Q ${200 + dx + (i % 2 ? 6 : -6)} ${SOIL_Y - 16} ${200 + dx + (i % 2 ? 11 : -11)} ${SOIL_Y - 26}`}
            stroke="oklch(0.56 0.11 148)"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity={0.5 + 0.4 * g}
          />
        ))}

        {/* The seed rests in the soil and fades as the sprout takes over */}
        {seed > 0.01 && (
          <ellipse
            cx="200"
            cy={SOIL_Y - 5}
            rx={5.5}
            ry={4}
            fill="oklch(0.42 0.06 60)"
            opacity={seed}
            style={{ transition: "opacity 900ms linear" }}
          />
        )}

        <g className="animate-canopy-sway" style={{ transformOrigin: `200px ${SOIL_Y}px` }}>
          {/* Stem */}
          <path
            d={`M200 ${SOIL_Y - 2} Q ${200 + lean * 0.9} ${SOIL_Y - stemH * 0.55} ${200 + lean} ${tipY}`}
            stroke="url(#cxStem)"
            strokeWidth={stemW}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "d 900ms linear, stroke-width 900ms linear" }}
          />

          {leaves.map((l) => (
            <Leaf
              key={`l${l.key}`}
              x={l.x}
              y={l.y}
              side={l.side}
              len={l.len}
              droop={l.droop}
              grow={l.grow}
            />
          ))}

          {/* Tender tip shoot, becoming a bud, then opening into a bloom */}
          <ellipse
            cx={200 + lean}
            cy={tipY - 2}
            rx={mix(2.4, 4.2, g)}
            ry={mix(5, 9, g)}
            fill="oklch(0.74 0.15 142)"
            opacity={1 - bloom * 0.7}
            style={{ transition: "cy 900ms linear, opacity 900ms linear" }}
          />
          {bud > 0.01 && (
            <g
              style={{
                transform: `translate(${200 + lean}px, ${tipY - 6}px)`,
                transition: "transform 900ms linear",
              }}
            >
              {[-58, -20, 20, 58].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy={-7}
                  rx={mix(3, 6, bloom)}
                  ry={mix(8, 13, bud)}
                  fill="oklch(0.9 0.08 350)"
                  opacity={bud}
                  style={{
                    transform: `rotate(${deg * (0.25 + 0.75 * bloom)}deg)`,
                    transformOrigin: "0px 0px",
                    transition: "transform 900ms linear, rx 900ms linear, ry 900ms linear",
                  }}
                />
              ))}
              <circle cx="0" cy={-7} r={mix(1.5, 3.6, bloom)} fill="oklch(0.94 0.11 95)" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function Leaf({
  x,
  y,
  side,
  len,
  droop,
  grow,
}: {
  x: number;
  y: number;
  side: number;
  len: number;
  droop: number;
  grow: number;
}) {
  if (grow <= 0.005) return null;
  return (
    <g
      className="animate-leaf-breathe"
      style={{
        transform: `translate(${x}px, ${y}px) scale(${grow})`,
        transformOrigin: "0px 0px",
        transition: "transform 900ms linear",
        opacity: 0.3 + 0.7 * grow,
        animationDelay: `-${(len * 0.37) % 6}s`,
      }}
    >
      {/* A tapering blade rather than a plain oval, so it reads botanical */}
      <path
        d={`M0 0 C ${side * len * 0.4} ${-droop} ${side * len * 0.8} ${-droop * 0.9} ${side * len} ${-droop * 0.2}
            C ${side * len * 0.75} ${droop * 0.55} ${side * len * 0.35} ${droop * 0.5} 0 0 Z`}
        fill="url(#cxLeaf)"
      />
      <path
        d={`M0 0 Q ${side * len * 0.55} ${-droop * 0.5} ${side * len} ${-droop * 0.2}`}
        stroke="oklch(0.8 0.09 140 / 0.55)"
        strokeWidth="0.8"
        fill="none"
      />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Moonlit Sky — twilight → night → moonlit → star-filled              */
/* ------------------------------------------------------------------ */

function MoonlitSky({ progress }: { progress: number }) {
  const p = clamp01(progress);
  const night = ease(p);
  const visibleStars = Math.round(mix(6, 44, night));
  const moonY = mix(26, 11, ease(ramp(p, 0.1, 0.8)));
  const moonGlow = mix(0.12, 0.42, night);

  const stars = useSeeded(() =>
    Array.from({ length: 44 }, (_, i) => ({
      left: `${((i * 27) % 98) + 1}%`,
      top: `${((i * 43) % 66) + 2}%`,
      size: 0.8 + (i % 4) * 0.55,
      duration: `${4 + ((i * 7) % 7)}s`,
      delay: `-${(i * 0.9) % 8}s`,
    })),
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Twilight base, with the deep night layer fading in over it */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_72%_6%,oklch(0.52_0.07_60)_0%,oklch(0.38_0.08_290)_45%,oklch(0.26_0.06_275)_100%)]" />
      <div
        className="absolute inset-0 bg-[radial-gradient(130%_100%_at_72%_8%,oklch(0.30_0.05_255)_0%,oklch(0.18_0.05_265)_52%,oklch(0.11_0.03_268)_100%)]"
        style={{ opacity: night, transition: "opacity 1500ms linear" }}
      />

      {/* Stars appear gradually as the night settles */}
      {stars.map((s, i) => {
        const on = clamp01((visibleStars - i) / 4);
        if (on <= 0.02) return null;
        return (
          <span
            key={`s${i}`}
            className="absolute rounded-full bg-white animate-star-twinkle"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: on,
              animationDuration: s.duration,
              animationDelay: s.delay,
              transition: "opacity 1500ms linear",
            }}
          />
        );
      })}

      {/* Moon, rising slightly and brightening */}
      <div
        className="absolute right-[15%] h-20 w-20 rounded-full animate-soft-glow"
        style={{
          top: `${moonY}%`,
          background:
            "radial-gradient(circle at 36% 34%, oklch(0.99 0.03 95) 0%, oklch(0.94 0.05 92) 58%, oklch(0.87 0.06 88) 100%)",
          boxShadow: `0 0 ${46 + 34 * night}px ${12 + 12 * night}px oklch(0.96 0.05 95 / ${moonGlow})`,
          transition: "top 2000ms linear, box-shadow 1500ms linear",
        }}
      >
        {/* Faint maria, kept very subtle */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 62% 30%, oklch(0.86 0.03 90 / 0.5) 0 6%, transparent 7%), radial-gradient(circle at 40% 66%, oklch(0.86 0.03 90 / 0.4) 0 9%, transparent 10%)",
          }}
        />
      </div>

      {/* Moonlight wash on the atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 82% 14%, oklch(0.95 0.04 95 / 0.18) 0%, transparent 70%)",
          opacity: 0.4 + 0.6 * night,
        }}
      />

      {/* Slow clouds */}
      {[0, 1, 2, 3].map((i) => (
        <span
          key={`c${i}`}
          className="absolute animate-cloud-drift rounded-full"
          style={{
            top: `${14 + i * 15}%`,
            width: `${170 + i * 80}px`,
            height: `${30 + i * 10}px`,
            background: `oklch(0.9 0.02 265 / ${0.1 + 0.05 * (i % 2)})`,
            filter: "blur(12px)",
            animationDuration: `${130 + i * 50}s`,
            animationDelay: `-${i * 28}s`,
          }}
        />
      ))}

      {/* Atmospheric haze near the horizon + distant hills */}
      <div
        className="absolute inset-x-0 bottom-0 h-[30%] animate-scene-haze"
        style={{
          background:
            "linear-gradient(to top, oklch(0.72 0.05 265 / 0.22) 0%, transparent 100%)",
        }}
      />
      <svg
        viewBox="0 0 400 90"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[18%] w-full"
      >
        <path
          d="M0 90 L0 54 Q60 30 124 48 Q188 22 250 46 Q312 26 400 52 L400 90 Z"
          fill="oklch(0.13 0.04 268 / 0.9)"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lotus Pond — closed bud → opening → full bloom → calm pond          */
/* ------------------------------------------------------------------ */

function LotusPond({ progress }: { progress: number }) {
  const p = clamp01(progress);
  const b = ease(p);
  // Petals begin almost shut and open continuously to a full bloom.
  const open = mix(0.14, 1, b);
  const rise = mix(0, 10, b);
  const glow = mix(0.2, 0.9, b);
  const stamen = ramp(p, 0.72, 0.22);

  const petalsOuter = [-84, -56, -28, 0, 28, 56, 84];
  const petalsMid = [-64, -34, -6, 22, 50];
  const petalsInner = [-40, -13, 13, 40];

  const mist = useSeeded(() =>
    Array.from({ length: 5 }, (_, i) => ({
      top: `${16 + i * 8}%`,
      width: `${50 + ((i * 19) % 36)}%`,
      left: `${(i * 21) % 42}%`,
      delay: `-${(i * 3.3) % 16}s`,
      duration: `${20 + ((i * 5) % 9)}s`,
      opacity: 0.08 + (i % 3) * 0.05,
    })),
  );

  return (
    <div className="absolute inset-0 bg-[radial-gradient(125%_95%_at_50%_2%,oklch(0.9_0.05_95)_0%,oklch(0.78_0.06_150)_42%,oklch(0.56_0.07_190)_100%)]">
      {/* Drifting dawn mist */}
      {mist.map((m, i) => (
        <span
          key={`m${i}`}
          className="absolute h-10 rounded-full animate-lotus-drift"
          style={{
            top: m.top,
            left: m.left,
            width: m.width,
            opacity: m.opacity,
            animationDelay: m.delay,
            animationDuration: m.duration,
            background: "linear-gradient(to right, transparent, oklch(0.99 0.01 120), transparent)",
            filter: "blur(11px)",
          }}
        />
      ))}

      {/* Water body with layered light bands */}
      <div className="absolute inset-x-0 bottom-0 h-[54%] bg-[linear-gradient(to_bottom,oklch(0.7_0.06_190_/_0.92)_0%,oklch(0.52_0.07_197)_46%,oklch(0.37_0.06_202)_100%)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={`w${i}`}
            className="absolute inset-x-0 animate-water-glide"
            style={{
              top: `${10 + i * 17}%`,
              height: 2 + (i % 2),
              background:
                "linear-gradient(to right, transparent, oklch(0.98 0.02 200 / 0.4), transparent)",
              filter: "blur(1.5px)",
              animationDuration: `${16 + i * 5}s`,
              animationDelay: `-${i * 4}s`,
              opacity: 0.35,
            }}
          />
        ))}
        <div
          className="absolute left-1/2 top-0 h-full w-32 -translate-x-1/2 animate-lotus-shimmer"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.99 0.02 130 / 0.24) 0%, oklch(0.96 0.02 150 / 0.07) 52%, transparent 100%)",
            filter: "blur(9px)",
          }}
        />
      </div>

      {/* Gentle ripples radiating from the flower */}
      {[0, 1, 2, 3].map((i) => (
        <span
          key={`r${i}`}
          className="absolute left-1/2 bottom-[18%] -translate-x-1/2 rounded-full border animate-ripple-out"
          style={{
            width: 78,
            height: 26,
            borderColor: "oklch(0.97 0.02 210 / 0.26)",
            animationDuration: "10s",
            animationDelay: `-${i * 2.5}s`,
          }}
        />
      ))}

      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYEnd slice"
        className="absolute inset-x-0 bottom-0 h-[52%] w-full"
      >
        <defs>
          <linearGradient id="cxPetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.97 0.04 340)" />
            <stop offset="100%" stopColor="oklch(0.79 0.1 348)" />
          </linearGradient>
          <linearGradient id="cxPetalInner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.99 0.02 330)" />
            <stop offset="100%" stopColor="oklch(0.9 0.06 345)" />
          </linearGradient>
          <linearGradient id="cxPad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.54 0.1 155 / 0.9)" />
            <stop offset="100%" stopColor="oklch(0.33 0.07 162 / 0.9)" />
          </linearGradient>
          <radialGradient id="cxLotusGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="oklch(0.97 0.05 340 / 0.4)" />
            <stop offset="100%" stopColor="oklch(0.97 0.05 340 / 0)" />
          </radialGradient>
        </defs>

        {/* Lily pads — notched discs, not plain ovals */}
        <g className="animate-lotus-drift" style={{ transformOrigin: "200px 172px" }}>
          {[
            { cx: 100, cy: 178, r: 40, o: 1 },
            { cx: 302, cy: 165, r: 33, o: 0.95 },
            { cx: 254, cy: 189, r: 25, o: 0.7 },
            { cx: 146, cy: 193, r: 21, o: 0.6 },
          ].map((pad, i) => (
            <path
              key={`pad${i}`}
              d={`M${pad.cx} ${pad.cy - pad.r * 0.26}
                  a ${pad.r} ${pad.r * 0.26} 0 1 0 ${pad.r * 0.34} ${pad.r * 0.5}
                  L${pad.cx} ${pad.cy}
                  Z
                  M${pad.cx} ${pad.cy - pad.r * 0.26}
                  a ${pad.r} ${pad.r * 0.26} 0 1 1 ${pad.r * 0.34} ${pad.r * 0.5} Z`}
              fill="url(#cxPad)"
              opacity={pad.o}
            />
          ))}
        </g>

        {/* Halo behind the lotus grows with the bloom */}
        <circle cx="200" cy={150 - rise} r={46 + 16 * b} fill="url(#cxLotusGlow)" opacity={glow} />

        {/* Reflection on the water */}
        <g
          className="animate-lotus-shimmer"
          style={{
            transform: `translate(200px,${184 - rise * 0.2}px) scale(1,-0.42)`,
            opacity: 0.26,
          }}
        >
          {petalsOuter.map((deg) => (
            <ellipse
              key={`ref${deg}`}
              cx="0"
              cy="-24"
              rx="10"
              ry="28"
              fill="url(#cxPetal)"
              style={{ transform: `rotate(${deg * open}deg)`, transformOrigin: "0px 0px" }}
            />
          ))}
        </g>

        {/* Lotus flower */}
        <g className="animate-lotus-sway" style={{ transformOrigin: "200px 176px" }}>
          <g
            style={{
              transform: `translate(200px,${168 - rise}px)`,
              transition: "transform 1200ms linear",
            }}
          >
            {petalsOuter.map((deg) => (
              <ellipse
                key={`o${deg}`}
                cx="0"
                cy="-24"
                rx={mix(8, 11, b)}
                ry={mix(24, 30, b)}
                fill="url(#cxPetal)"
                stroke="oklch(0.88 0.06 345 / 0.5)"
                strokeWidth="0.7"
                style={{
                  transform: `rotate(${deg * open}deg)`,
                  transformOrigin: "0px 0px",
                  transition: "transform 1200ms linear, rx 1200ms linear, ry 1200ms linear",
                }}
              />
            ))}
            {petalsMid.map((deg) => (
              <ellipse
                key={`mid${deg}`}
                cx="0"
                cy="-21"
                rx={mix(6.5, 9, b)}
                ry={mix(20, 25, b)}
                fill="url(#cxPetalInner)"
                style={{
                  transform: `rotate(${deg * open * 0.82}deg)`,
                  transformOrigin: "0px 0px",
                  transition: "transform 1200ms linear",
                }}
              />
            ))}
            {petalsInner.map((deg) => (
              <ellipse
                key={`in${deg}`}
                cx="0"
                cy="-17"
                rx={mix(5.5, 7, b)}
                ry={mix(16, 20, b)}
                fill="oklch(0.99 0.03 338 / 0.96)"
                style={{
                  transform: `rotate(${deg * open * 0.6}deg)`,
                  transformOrigin: "0px 0px",
                  transition: "transform 1200ms linear",
                }}
              />
            ))}
            <circle cx="0" cy="-16" r={mix(4, 7, b)} fill="oklch(0.94 0.11 95)" />
            {stamen > 0.01 &&
              [-26, -9, 9, 26].map((deg) => (
                <line
                  key={`st${deg}`}
                  x1="0"
                  y1="-16"
                  x2={0}
                  y2={-16 - 9 * stamen}
                  stroke="oklch(0.97 0.09 95)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity={stamen}
                  style={{ transform: `rotate(${deg}deg)`, transformOrigin: "0px -16px" }}
                />
              ))}
            <circle cx="0" cy="-16" r={2.2} fill="oklch(0.99 0.05 95)" />
          </g>
        </g>
      </svg>
    </div>
  );
}
