import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  GOOGLE_PLAY_URL,
  INDUS_APPSTORE_URL,
  googlePlayBadgeAsset,
} from "@/lib/app-stores";
import { hasNativeBridge } from "@/lib/native-session";

const SEEN_KEY = "commitx-app-promo-seen";

/**
 * First-visit nudge to install CommitX from Google Play.
 *
 * Shows once per browser: the moment it appears we record it, so refreshing the
 * page never interrupts the same person twice. It never appears inside the
 * Android app, where the app is already installed.
 */
export function AppPromoPopup() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hasNativeBridge()) return;

    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = true; // storage blocked — don't interrupt the visit
    }
    if (seen) return;

    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* recording failed — the pop-up still shows once this visit */
      }
      setOpen(true);
    }, 1400);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/30 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Get the CommitX app"
      onClick={() => setOpen(false)}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="animate-landing-modal w-full max-w-md rounded-t-[28px] bg-paper p-7 pb-8 shadow-lift outline-none sm:rounded-[28px] sm:p-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
            CommitX for Android
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-[26px] font-medium leading-[1.15] tracking-[-0.02em]">
          Take your focus with you
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Install CommitX from Google Play and keep Focus Shield, Verified
          sessions and your streak in your pocket.
        </p>

        <a
          href={GOOGLE_PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          aria-label="Get CommitX on Google Play"
          className="mt-7 inline-flex w-full justify-center sm:w-auto sm:justify-start"
        >
          <img
            src={googlePlayBadgeAsset.url}
            alt="Get it on Google Play"
            width={239}
            height={71}
            className="cx-store-badge-plain"
          />
        </a>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-ink-line/70 pt-4">
          <a
            href={INDUS_APPSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="text-xs text-ink/85 underline decoration-ink-line underline-offset-4 transition-colors hover:text-ink"
          >
            Also on the Indus App Store
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-ink/85 transition-colors hover:text-ink"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
