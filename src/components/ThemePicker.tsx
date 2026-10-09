import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SESSION_THEMES,
  readLastTheme,
  rememberTheme,
  type SessionThemeId,
} from "@/lib/session-themes";

/**
 * Calm theme selector shown right before a session starts. Compact rows, all
 * five themes visible without scrolling. Exactly one theme must be selected;
 * the session only begins on explicit confirmation.
 */
export function ThemePicker({
  open,
  starting,
  confirmLabel = "Start Commitment",
  title = "Choose your session mood",
  subtitle = "One calm scene for the whole session.",
  onCancel,
  onConfirm,
  error,
  busyLabel = "Starting…",
}: {
  open: boolean;
  starting?: boolean;
  confirmLabel?: string;
  title?: string;
  subtitle?: string;
  onCancel: () => void;
  onConfirm: (theme: SessionThemeId) => void;
  /** Shown inside the sheet so a failed action never silently closes it. */
  error?: string | null;
  busyLabel?: string;
}) {
  const [selected, setSelected] = useState<SessionThemeId | null>(() => readLastTheme());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-t-[28px] bg-card p-5 shadow-lift sm:rounded-[28px] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Session theme
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold sm:text-2xl">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close theme selection"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {SESSION_THEMES.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-hairline hover:border-muted-foreground/40",
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {t.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-semibold">
                    {t.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.tagline}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-hairline",
                  )}
                >
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={!selected || starting}
          onClick={() => {
            if (!selected) return;
            rememberTheme(selected);
            onConfirm(selected);
          }}
          className="mt-5 w-full rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {starting ? busyLabel : selected ? confirmLabel : "Select a theme to continue"}
        </button>
        <p className="mt-2.5 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Themes are visual only · your session rules never change
        </p>
      </div>
    </div>
  );
}
