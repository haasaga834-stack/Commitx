import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DURATION_OPTIONS, formatDuration } from "@/lib/planner";

const ITEM_H = 46;
const VISIBLE = 5;

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  includeStarter?: boolean;
}

function tick() {
  try {
    navigator.vibrate?.(6);
  } catch {
    /* haptics unavailable */
  }
}

/**
 * 3D roller-drum duration picker. Native scroll gives momentum and snapping;
 * each row is curved, scaled and faded by its distance from the centre line.
 */
export function DurationWheel({ value, onChange, includeStarter = false }: Props) {
  const options = includeStarter ? [15, ...DURATION_OPTIONS] : DURATION_OPTIONS;
  const ref = useRef<HTMLDivElement | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const raf = useRef<number>(0);
  const syncing = useRef(false);
  const lastIndex = useRef(Math.max(0, options.indexOf(value)));
  const [centre, setCentre] = useState(lastIndex.current);

  function paint() {
    const el = ref.current;
    if (!el) return;
    const pos = el.scrollTop / ITEM_H;
    items.current.forEach((node, i) => {
      if (!node) return;
      const d = Math.max(-2.6, Math.min(2.6, i - pos));
      const a = Math.abs(d);
      node.style.transform = `perspective(520px) rotateX(${-d * 24}deg) scale(${1 - a * 0.11})`;
      node.style.opacity = String(Math.max(0.18, 1 - a * 0.36));
    });
    const i = Math.min(options.length - 1, Math.max(0, Math.round(pos)));
    if (i !== lastIndex.current) {
      lastIndex.current = i;
      setCentre(i);
      if (!syncing.current) tick();
    }
    return i;
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, options.indexOf(value));
    const top = i * ITEM_H;
    if (Math.abs(el.scrollTop - top) > 2) {
      syncing.current = true;
      el.scrollTo({ top, behavior: el.scrollTop === 0 && i > 0 ? "auto" : "smooth" });
      window.setTimeout(() => {
        syncing.current = false;
      }, 320);
    }
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(settle.current); }, []);

  const settle = useRef<number>(0);
  function onScroll() {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const i = paint();
      if (i === undefined || syncing.current) return;
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        const next = options[i];
        if (next !== value) onChange(next);
      }, 90);
    });
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;

  return (
    <div className="relative mt-2 overflow-hidden rounded-3xl border border-hairline bg-background">
      {/* centre selection band */}
      <div
        className="pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-hairline bg-accent/10"
        style={{ height: ITEM_H }}
      />
      {/* top / bottom fade for the drum curvature */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-background to-transparent" />
      <div
        ref={ref}
        onScroll={onScroll}
        role="listbox"
        aria-label="Select a duration"
        className="no-scrollbar relative snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ height: ITEM_H * VISIBLE, scrollbarWidth: "none" }}
      >
        <div style={{ height: pad }} aria-hidden />
        {options.map((m, i) => {
          const active = i === centre;
          return (
            <button
              type="button"
              key={m}
              ref={(n) => {
                items.current[i] = n;
              }}
              role="option"
              aria-selected={m === value}
              aria-label={formatDuration(m)}
              onClick={() => onChange(m)}
              className="flex w-full snap-center items-center justify-center tabular-nums will-change-transform"
              style={{ height: ITEM_H }}
            >
              <span
                className={
                  active
                    ? "font-display text-2xl font-semibold text-foreground"
                    : "text-base text-muted-foreground"
                }
              >
                {m}
              </span>
              {active && <span className="ml-1.5 text-xs font-medium text-muted-foreground">min</span>}
            </button>
          );
        })}
        <div style={{ height: pad }} aria-hidden />
      </div>
    </div>
  );
}
