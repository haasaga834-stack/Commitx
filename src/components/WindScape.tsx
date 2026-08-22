import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const BLADES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 3.9 + (i % 3) * 1.2) % 100}%`,
  height: 26 + ((i * 13) % 34),
  delay: `-${(i * 0.7) % 9}s`,
  duration: `${8 + ((i * 3) % 6)}s`,
  opacity: 0.16 + ((i % 4) * 0.05),
}));

/** Soft, natural leaf tones: light green, pale green, soft yellow, warm pastel. */
const LEAF_TINTS = [
  "rgba(150, 200, 140, ",
  "rgba(186, 216, 160, ",
  "rgba(232, 224, 158, ",
  "rgba(214, 199, 152, ",
  "rgba(170, 205, 175, ",
  "rgba(240, 214, 170, ",
];

type Leaf = {
  x: number;
  y: number;
  size: number;
  fall: number; // px/s downward
  rot: number;
  rotSpeed: number;
  swayAmp: number; // px/s lateral own-sway amplitude
  swayFreq: number;
  swayPhase: number;
  windFactor: number; // how much the global breeze moves it
  opacity: number;
  tint: string;
  shape: number;
  flutter: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function spawnLeaf(w: number, h: number, atTop: boolean): Leaf {
  const size = rand(9, 22);
  return {
    x: rand(-0.1 * w, 1.1 * w),
    y: atTop ? rand(-h * 0.35, -20) : rand(-h * 0.2, h),
    size,
    fall: rand(12, 34) * (0.7 + size / 40),
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-0.5, 0.5),
    swayAmp: rand(2, 20),
    swayFreq: rand(0.08, 0.32),
    swayPhase: rand(0, Math.PI * 2),
    windFactor: rand(0.35, 1.25),
    opacity: rand(0.35, 0.8),
    tint: LEAF_TINTS[Math.floor(Math.random() * LEAF_TINTS.length)],
    shape: Math.floor(rand(0, 3)),
    flutter: rand(0.6, 1.6),
  };
}

function drawLeaf(ctx: CanvasRenderingContext2D, leaf: Leaf, t: number) {
  const s = leaf.size;
  // gentle flutter: leaf turns edge-on now and then
  const squash = 0.35 + 0.65 * Math.abs(Math.sin(t * leaf.flutter + leaf.swayPhase));
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.rot);
  ctx.scale(squash, 1);
  ctx.fillStyle = `${leaf.tint}${leaf.opacity.toFixed(3)})`;
  ctx.beginPath();
  if (leaf.shape === 0) {
    // pointed almond leaf
    ctx.moveTo(0, -s * 0.7);
    ctx.bezierCurveTo(s * 0.55, -s * 0.2, s * 0.4, s * 0.5, 0, s * 0.7);
    ctx.bezierCurveTo(-s * 0.4, s * 0.5, -s * 0.55, -s * 0.2, 0, -s * 0.7);
  } else if (leaf.shape === 1) {
    // rounder soft leaf
    ctx.ellipse(0, 0, s * 0.42, s * 0.62, 0, 0, Math.PI * 2);
  } else {
    // slim curved leaf
    ctx.moveTo(0, -s * 0.75);
    ctx.quadraticCurveTo(s * 0.5, 0, 0, s * 0.75);
    ctx.quadraticCurveTo(-s * 0.18, 0, 0, -s * 0.75);
  }
  ctx.fill();
  // subtle midrib
  ctx.strokeStyle = `${leaf.tint}${(leaf.opacity * 0.45).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.5, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6);
  ctx.lineTo(0, s * 0.6);
  ctx.stroke();
  ctx.restore();
}

function LeafCanvas({ density = 1 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let leaves: Leaf[] = [];
    let raf = 0;
    let last = 0;
    let time = 0;
    let nextSpawn = 0;

    const targetCount = () => {
      const area = (width * height) / (390 * 780);
      return Math.max(6, Math.min(22, Math.round(12 * density * Math.sqrt(Math.max(area, 0.4)))));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (leaves.length === 0) {
        leaves = Array.from({ length: targetCount() }, () => spawnLeaf(width, height, false));
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // smooth, slowly reversing breeze built from a few incommensurate sines
    const wind = (t: number) =>
      26 * Math.sin(t * 0.055) + 14 * Math.sin(t * 0.021 + 1.7) + 7 * Math.sin(t * 0.13 + 0.4);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1; // cap after tab/app resume
      time += dt;

      ctx.clearRect(0, 0, width, height);
      const gust = wind(time);

      for (const leaf of leaves) {
        const own = leaf.swayAmp * Math.sin(time * leaf.swayFreq * Math.PI * 2 + leaf.swayPhase);
        leaf.x += (gust * leaf.windFactor + own) * dt;
        leaf.y += leaf.fall * dt;
        leaf.rot += leaf.rotSpeed * dt + gust * 0.0006 * dt * 60;

        const pad = leaf.size * 2;
        if (leaf.y - pad > height || leaf.x < -width * 0.3 || leaf.x > width * 1.3) {
          Object.assign(leaf, spawnLeaf(width, height, true));
        }
        drawLeaf(ctx, leaf, time);
      }

      // occasional extra leaf entering at a random moment/position
      if (time > nextSpawn) {
        nextSpawn = time + rand(1.5, 6);
        if (leaves.length < targetCount() + 4) {
          leaves.push(spawnLeaf(width, height, true));
        }
      }
      if (leaves.length > targetCount() + 4) leaves.shift();
    };

    if (reduce) {
      // draw one calm static frame
      for (const leaf of leaves) drawLeaf(ctx, leaf, 0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onVisibility = () => {
      if (reduce) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

/**
 * Ghibli-inspired breeze backdrop: soft sunlight, layered hills, swaying grass and
 * canvas-driven leaves that each follow their own trajectory while a slowly
 * reversing wind carries them sideways. Purely decorative.
 */
export function WindScape({
  className,
  fixed = true,
  density = 1,
}: {
  className?: string;
  fixed?: boolean;
  density?: number;
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

      {/* Layered painted hills - kept low so they stay beneath the timer */}
      <svg
        className="absolute inset-x-0 bottom-0 block w-full"
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 96c52-18 88 4 138-6 48-11 78-22 122-9 40 12 76 4 140-10v69H0V96Z"
          fill="var(--color-primary)"
          opacity="0.10"
        />
        <path
          d="M0 114c58-12 98 6 158-3 54-10 96-12 144 3 34 10 66 7 98 2v24H0v-26Z"
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

      {/* Naturally falling leaves carried by a changing breeze */}
      <LeafCanvas density={density} />
    </div>
  );
}
