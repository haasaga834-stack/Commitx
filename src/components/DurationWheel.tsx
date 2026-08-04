import { useEffect, useRef } from "react";
import { DURATION_OPTIONS, formatDuration } from "@/lib/planner";

const ITEM_H = 44;

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

/** Vertical scroll-snap wheel selector for the session duration. */
export function DurationWheel({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number>(0);
  const syncing = useRef(false);

  // Center the current value on mount / external change.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, DURATION_OPTIONS.indexOf(value));
    const top = i * ITEM_H;
    if (Math.abs(el.scrollTop - top) > 2) {
      syncing.current = true;
      el.scrollTo({ top });
      window.setTimeout(() => {
        syncing.current = false;
      }, 60);
    }
  }, [value]);

  function onScroll() {
    if (syncing.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(
        DURATION_OPTIONS.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM_H)),
      );
      const next = DURATION_OPTIONS[i];
      if (next !== value) onChange(next);
    });
  }

  return (
    <div className="relative mt-2 overflow-hidden rounded-2xl border border-hairline bg-background">
      <div
        className="pointer-events-none absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-xl bg-accent/12"
        style={{ height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar relative snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ height: ITEM_H * 3, scrollbarWidth: "none" }}
      >
        <div style={{ height: ITEM_H }} aria-hidden />
        {DURATION_OPTIONS.map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => onChange(m)}
            className={`flex w-full snap-center items-center justify-center text-sm transition-colors ${
              m === value ? "font-semibold text-primary" : "text-muted-foreground"
            }`}
            style={{ height: ITEM_H }}
          >
            {formatDuration(m)}
          </button>
        ))}
        <div style={{ height: ITEM_H }} aria-hidden />
      </div>
    </div>
  );
}
