import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal "swipe to start" control. Vertical scrolling is preserved because
 * the track only claims horizontal gestures (touch-action: pan-y) and it only
 * begins tracking once the pointer has moved mostly sideways.
 */
export function SwipeToStart({
  label = "Swipe to start commitment",
  onStart,
  className,
}: {
  label?: string;
  onStart: () => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const decided = useRef<null | "x" | "y">(null);
  const pointerId = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dx, setDx] = useState(0);
  const [done, setDone] = useState(false);

  const maxTravel = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 280;
    return Math.max(40, w - 64);
  }, []);

  const reset = useCallback(() => {
    setDragging(false);
    setDx(0);
    decided.current = null;
    pointerId.current = null;
  }, []);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 900);
    return () => window.clearTimeout(id);
  }, [done]);

  function onPointerDown(e: React.PointerEvent) {
    if (done) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    decided.current = null;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId || done) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (!decided.current) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      decided.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (decided.current === "x") {
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
    }
    if (decided.current !== "x") return;
    setDx(Math.max(0, Math.min(maxTravel(), deltaX)));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId) return;
    const travel = maxTravel();
    const completed = decided.current === "x" && dx >= travel * 0.82;
    reset();
    if (completed) {
      setDone(true);
      onStart();
    }
  }

  const progress = Math.min(1, dx / maxTravel());

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        "relative h-16 w-full select-none overflow-hidden rounded-full border border-hairline bg-secondary/70 shadow-soft",
        className,
      )}
      style={{ touchAction: "pan-y" }}
    >
      {/* Filling warmth behind the knob */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full bg-primary/15",
          !dragging && "transition-[width] duration-500 ease-out",
        )}
        style={{ width: `${dx + 56}px` }}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 px-16">
        <span
          className="truncate text-sm font-medium text-foreground/80"
          style={{ opacity: 1 - progress * 0.9 }}
        >
          {done ? "Starting…" : label}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center gap-0.5 text-muted-foreground">
        <ChevronsRight className="h-4 w-4 animate-swipe-hint" style={{ opacity: 1 - progress }} />
      </div>

      <div
        className={cn(
          "absolute top-2 left-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift",
          !dragging && "transition-transform duration-500 ease-out",
        )}
        style={{ transform: `translateX(${dx}px)` }}
      >
        <ArrowRight className="h-5 w-5" />
      </div>
    </div>
  );
}
