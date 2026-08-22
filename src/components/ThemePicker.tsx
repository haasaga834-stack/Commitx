import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SESSION_THEMES,
  readLastTheme,
  rememberTheme,
  type SessionThemeId,
} from "@/lib/session-themes";
import { ThemePreview } from "@/components/SessionScene";

/**
 * Calm theme selector shown right before a session starts. Exactly one theme
 * must be selected; the session only begins on explicit confirmation.
 */
export function ThemePicker({
  open,
  starting,
  confirmLabel = "Start Commitment",
  title = "Choose your session mood",
  subtitle = "One calm scene for the whole session.",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  starting?: boolean;
  confirmLabel?: string;
  title?: string;
  subtitle?: string;
  onCancel: () => void;
  onConfirm: (theme: SessionThemeId) => void;
}) {
  const [selected, setSelected] = useState<SessionThemeId | null>(() => readLastTheme());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-card p-6 shadow-lift sm:rounded-[28px] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Session theme
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close theme selection"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SESSION_THEMES.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                aria-pressed={active}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-4 text-left transition-all",
                  active
                    ? "border-primary shadow-lift"
                    : "border-hairline shadow-soft hover:border-muted-foreground/40",
                )}
              >
                <ThemePreview theme={t.id} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold">
                      <span className="mr-1.5">{t.emoji}</span>
                      {t.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.tagline}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{t.detail}</p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-hairline",
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          disabled={!selected || starting}
          onClick={() => {
            if (!selected) return;
            rememberTheme(selected);
            onConfirm(selected);
          }}
          className="mt-7 w-full rounded-full bg-primary px-8 py-4.5 text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {starting ? "Starting…" : selected ? confirmLabel : "Select a theme to continue"}
        </button>
        <p className="mt-3 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Themes are visual only · your session rules never change
        </p>
      </div>
    </div>
  );
}
