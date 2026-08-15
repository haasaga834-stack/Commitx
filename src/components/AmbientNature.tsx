import { cn } from "@/lib/utils";

const LEAVES = [
  { left: "8%", delay: "0s", duration: "24s", size: 18, rotate: -12 },
  { left: "28%", delay: "6s", duration: "30s", size: 13, rotate: 20 },
  { left: "54%", delay: "12s", duration: "26s", size: 16, rotate: 8 },
  { left: "78%", delay: "3s", duration: "34s", size: 12, rotate: -24 },
  { left: "92%", delay: "16s", duration: "28s", size: 15, rotate: 14 },
];

const PARTICLES = [
  { left: "16%", top: "22%", delay: "0s", size: 5 },
  { left: "72%", top: "16%", delay: "1.6s", size: 4 },
  { left: "36%", top: "62%", delay: "3.1s", size: 6 },
  { left: "84%", top: "70%", delay: "2.2s", size: 4 },
  { left: "56%", top: "40%", delay: "4.4s", size: 5 },
  { left: "8%", top: "48%", delay: "5.6s", size: 3 },
  { left: "64%", top: "84%", delay: "6.8s", size: 4 },
  { left: "44%", top: "12%", delay: "2.9s", size: 3 },
];


/**
 * Soft, hand-painted nature backdrop: gentle clouds, drifting leaves and
 * glowing motes. Purely decorative and never interactive.
 */
export function AmbientNature({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none",
        className,
      )}
    >
      {/* Soft sun wash */}
      <div
        className="absolute -top-24 -right-20 h-72 w-72 rounded-full opacity-40 blur-3xl bg-gradient-sun"
      />
      {/* Grounded green haze */}
      <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />

      {/* Warm hand-painted paper grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-clay) 0.5px, transparent 0.6px), radial-gradient(var(--color-primary) 0.5px, transparent 0.6px)",
          backgroundSize: "7px 7px, 11px 11px",
          backgroundPosition: "0 0, 3px 4px",
        }}
      />

      {/* Distant painted hills */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full opacity-[0.10]"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 78c48-26 84 6 132-10 46-15 74-30 118-12 40 16 78 6 150-14v78H0V78Z"
          fill="var(--color-primary)"
        />
        <path
          d="M0 98c56-18 96 8 156-6 54-13 96-16 144 4 34 14 68 10 100 2v22H0V98Z"
          fill="var(--color-clay)"
          opacity="0.7"
        />
      </svg>


      {/* Gentle clouds */}
      <svg
        className="absolute inset-x-0 top-6 w-full animate-cloud-drift opacity-[0.16]"
        viewBox="0 0 400 90"
        fill="none"
      >
        <path
          d="M30 62c-10 0-18-7-18-16s8-16 18-16c3-11 13-19 25-19 13 0 24 9 26 21 9 1 16 8 16 16 0 9-8 14-18 14H30Z"
          fill="var(--color-clay)"
        />
        <path
          d="M250 70c-9 0-16-6-16-14s7-14 16-14c3-10 12-17 23-17 11 0 21 8 23 19 8 1 14 7 14 14 0 8-7 12-16 12h-44Z"
          fill="var(--color-clay)"
        />
      </svg>

      {/* Drifting leaves */}
      {LEAVES.map((leaf, i) => (
        <svg
          key={i}
          className="absolute top-0 animate-leaf-drift"
          style={{
            left: leaf.left,
            width: leaf.size,
            height: leaf.size * 1.4,
            animationDelay: leaf.delay,
            animationDuration: leaf.duration,
          }}
          viewBox="0 0 20 28"
          fill="none"
        >
          <path
            d="M10 1C3 8 0 15 3 21c3 6 11 7 14 1 3-6 1-14-7-21Z"
            fill="var(--color-primary)"
            opacity="0.5"
          />
          <path d="M10 4v20" stroke="var(--color-primary)" strokeWidth="0.8" opacity="0.7" />
        </svg>
      ))}

      {/* Glowing motes */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-accent animate-particle-glow blur-[1px]"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
