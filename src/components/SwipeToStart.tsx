import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

/**
 * Horizontal "swipe to start" control. Drag the knob left-to-right; releasing
 * early springs it back. Vertical gestures are handed back to the page so
 * scrolling keeps working.
 */
export function SwipeToStart({
  label = "Swipe to Start Commitment",
  onStart,
}: {
  label?: string;
  onStart: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"none" | "x" | "y">("none");
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const maxX = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 280;
    return Math.max(40, w - 64);
  }, []);

  const reset = () => {
    setDragging(false);
    setX(0);
    startRef.current = null;
    axisRef.current = "none";
  };

  useEffect(() => {
    if (!dragging) return;

    const move = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;

      if (axisRef.current === "none") {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axisRef.current === "y") {
          reset();
          return;
        }
      }
      setX(Math.max(0, Math.min(maxX(), dx)));
    };

    const up = () => {
      const limit = maxX();
      setDragging(false);
      setX((cur) => {
        if (cur >= limit * 0.82) {
          setDone(true);
          window.setTimeout(onStart, 240);
          return limit;
        }
        return 0;
      });
      startRef.current = null;
      axisRef.current = "none";
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, maxX, onStart]);

  const pct = x / Math.max(1, maxX());

  return (
    <div
      ref={trackRef}
      className="relative h-14 w-full select-none overflow-hidden rounded-full bg-primary shadow-soft"
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart();
        }
      }}
    >
      {/* cozy sheen sweeping across the track */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-y-0 w-16 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </div>

      {/* progress warmth */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-white/12 transition-[width] duration-150"
        style={{ width: `${pct * 100}%` }}
      />

      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-8 text-sm font-medium text-primary-foreground transition-opacity"
        style={{ opacity: done ? 0 : 1 - pct * 0.9 }}
      >
        {label}
      </span>

      {done && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-primary-foreground">
          Starting…
        </span>
      )}

      <button
        type="button"
        aria-label={label}
        onPointerDown={(e) => {
          if (done) return;
          startRef.current = { x: e.clientX, y: e.clientY };
          axisRef.current = "none";
          setDragging(true);
        }}
        className="absolute top-1.5 left-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary shadow-soft"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 340ms cubic-bezier(0.22,1,0.36,1)",
          touchAction: "pan-y",
        }}
      >
        {done ? (
          <Check className="h-5 w-5" strokeWidth={3} />
        ) : (
          <ArrowRight className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
