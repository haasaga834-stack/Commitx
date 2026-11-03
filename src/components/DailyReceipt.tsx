import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Flame, Check, X, ShieldCheck } from "lucide-react";
import type { Session } from "@/lib/commitx-store";
import { buildDailyReceipt } from "@/lib/daily-receipt";
import { formatHours } from "@/lib/analytics-data";
import { shareInvite } from "@/lib/share-invite";
import { GOOGLE_PLAY_URL } from "@/lib/app-stores";

/** Compact end-of-day "proof of discipline" ticket built from local history (works offline). */
export function DailyReceipt({ sessions }: { sessions: Session[] }) {
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const day = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - offset); return d; }, [offset]);
  const r = useMemo(() => buildDailyReceipt(sessions, day), [sessions, day]);
  const peak = Math.max(30, ...r.hours);
  const dateLabel = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  const share = async () => {
    const text = [
      `🧾 My CommitX receipt · ${dateLabel}`,
      `⏱️ Locked in: ${formatHours(r.lockedMinutes)}`,
      `✅ Kept ${r.completed} · ❌ Quit ${r.forfeited}${r.discipline !== null ? ` · 🔥 ${r.discipline}% discipline` : ""}`,
      `Verdict: ${r.verdict}`,
      ``,
      `Lock in with me on CommitX 👇`,
    ].join("\n");
    const native = window.CommitXAndroid;
    const res = await shareInvite("Share my receipt", text, GOOGLE_PLAY_URL, {
      nativeShare: native?.shareText ? (t, m) => native.shareText?.(t, m) : undefined,
      webShare: !native && navigator.share ? (d) => navigator.share(d) : undefined,
      copy: navigator.clipboard?.writeText ? (m) => navigator.clipboard.writeText(m) : undefined,
    });
    if (res === "copied" && !native) {
      // Desktop browsers without a share sheet: open WhatsApp with the message ready.
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${GOOGLE_PLAY_URL}`)}`, "_blank", "noopener");
      setNotice("Opened WhatsApp — receipt also copied.");
    } else {
      setNotice(res === "unavailable" ? "Sharing isn't available here." : null);
    }
  };

  const Stat = ({ icon, v, k }: { icon: React.ReactNode; v: string; k: string }) => (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-muted/60 py-2">
      <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">{icon}{v}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</span>
    </div>
  );

  return (
    <section className="mt-6">
      <div className="cx-receipt relative mx-auto max-w-sm overflow-hidden rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <button aria-label="Previous day" onClick={() => setOffset((o) => Math.min(30, o + 1))} className="grid h-8 w-8 place-items-center rounded-full bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">🧾 Daily receipt</p>
            <p className="text-xs text-foreground">{offset === 0 ? "Today" : dateLabel}</p>
          </div>
          <button aria-label="Next day" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold leading-none tabular-nums text-primary">{formatHours(r.lockedMinutes)}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">locked in</p>
          </div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-wider text-primary">{r.verdict}</span>
        </div>

        <div className="mt-3 flex h-7 items-end gap-[2px]" aria-label="Focus by hour">
          {r.hours.map((m, i) => (
            <div key={i} className="flex-1 rounded-full" style={{ height: `${m ? Math.max(25, (m / peak) * 100) : 12}%`, background: m ? "var(--color-primary)" : "var(--color-muted)" }} />
          ))}
        </div>

        <div className="cx-receipt-cut my-3" />

        <div className="flex gap-2">
          <Stat icon={<Check className="h-3.5 w-3.5 text-primary" />} v={String(r.completed)} k="Kept" />
          <Stat icon={<X className="h-3.5 w-3.5 text-destructive" />} v={String(r.forfeited)} k="Quit" />
          <Stat icon={<ShieldCheck className="h-3.5 w-3.5" />} v={String(r.verified)} k="Verified" />
          <Stat icon={<Flame className="h-3.5 w-3.5 text-primary" />} v={r.discipline === null ? "—" : `${r.discipline}%`} k="Discipline" />
        </div>

        <button onClick={share} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          <Share2 className="h-4 w-4" /> Share receipt
        </button>
        {notice && <p className="mt-2 text-center text-[11px] text-muted-foreground">{notice}</p>}
      </div>
    </section>
  );
}
