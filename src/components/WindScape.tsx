import { cn } from "@/lib/utils";

const BLADES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 3.9 + (i % 3) * 1.2) % 100}%`,
  height: 26 + ((i * 13) % 34),
  delay: `-${(i * 0.7) % 9}s`,
  duration: `${8 + ((i * 3) % 6)}s`,
  opacity: 0.16 + ((i % 4) * 0.05),
}));

const LEAF_TINTS = [
  "oklch(0.72 0.115 138)", // light green
  "oklch(0.86 0.095 100)", // soft yellow-green
  "oklch(0.88 0.070 86)", // warm cream
  "oklch(0.66 0.090 145)", // meadow green
  "oklch(0.80 0.100 78)", // pale sunlight
];

const LEAVES = Array.from({ length: 8 }, (_, i) => ({
  top: `${10 + i * 10}%`,
  size: 8 + ((i * 3) % 7),
  delay: `-${i * 6.5}s`,
  duration: `${46 + i * 6}s`,
  fill: LEAF_TINTS[i % LEAF_TINTS.length],
  opacity: 0.34 + ((i % 3) * 0.09),
}));


const MOTES = Array.from({ length: 9 }, (_, i) => ({
  left: `${(i * 11 + 4) % 90}%`,
  top: `${(i * 17 + 12) % 88}%`,
  size: 2 + (i % 3),
  delay: `-${i * 2.4}s`,
  duration: `${18 + ((i * 4) % 10)}s`,
}));

/**
 * Original Ghibli-inspired flowing-wind backdrop: layered hills, swaying grass,
 * drifting leaves and soft atmospheric motes. Purely decorative, CSS-driven and
 * lightweight (no JS animation loop), so it is battery friendly during sessions.
 */
export function WindScape({
  className,
  fixed = true,
}: {
  className?: string;
  fixed?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        fixed ? "fixed inset-0 -z-10" : "absolute inset-0",
        "pointer-events-none select-none overflow-hidden",
        className,
      )}
    >
      {/* Warm pale-yellow sunlight, softly breathing */}
      <div className="absolute -top-24 right-[-15%] h-72 w-72 animate-sun-breathe rounded-full bg-gradient-sun blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div
        className="absolute left-[18%] top-[8%] h-40 w-40 animate-sun-breathe rounded-full bg-accent/20 blur-3xl"
        style={{ animationDelay: "-7s", animationDuration: "24s" }}
      />


      {/* Flowing wind mist bands */}
      <div className="absolute inset-x-[-20%] top-[16%] h-24 animate-wind-mist rounded-full bg-clay/25 blur-2xl" />
      <div
        className="absolute inset-x-[-20%] top-[42%] h-20 animate-wind-mist rounded-full bg-primary/12 blur-2xl"
        style={{ animationDelay: "-12s", animationDuration: "38s" }}
      />

      {/* Layered painted hills */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full"
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 84c52-24 88 8 138-8 48-15 78-30 122-12 40 16 76 6 140-14v90H0V84Z"
          fill="var(--color-primary)"
          opacity="0.10"
        />
        <path
          d="M0 104c58-16 98 10 158-4 54-13 96-16 144 4 34 14 66 10 98 2v34H0v-36Z"
          fill="var(--color-primary)"
          opacity="0.16"
        />
      </svg>

      {/* Swaying grass along the ground */}
      <div className="absolute inset-x-0 bottom-0 h-40">
        {BLADES.map((b, i) => (
          <span
            key={i}
            className="absolute bottom-0 block w-[2px] animate-wind-sway rounded-full bg-primary"
            style={{
              left: b.left,
              height: b.height,
              opacity: b.opacity,
              animationDelay: b.delay,
              animationDuration: b.duration,
            }}
          />
        ))}
      </div>

      {/* Small leaves gliding slowly on the breeze */}
      {LEAVES.map((l, i) => (
        <svg
          key={i}
          className="absolute left-0 animate-wind-glide"
          style={{
            top: l.top,
            width: l.size,
            height: l.size * 1.4,
            animationDelay: l.delay,
            animationDuration: l.duration,
          }}
          viewBox="0 0 20 28"
          fill="none"
        >
          <path
            d="M10 1C3 8 0 15 3 21c3 6 11 7 14 1 3-6 1-14-7-21Z"
            fill={l.fill}
            opacity={l.opacity}
          />
          <path d="M10 3v20" stroke={l.fill} strokeWidth="0.8" opacity={l.opacity * 0.6} />
        </svg>
      ))}


      {/* Soft atmospheric motes */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="absolute block animate-wind-mote rounded-full bg-accent blur-[1px]"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  );
}
