import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Receipt as ReceiptIcon } from "lucide-react";
import type { Session } from "@/lib/commitx-store";
import { buildDailyReceipt } from "@/lib/daily-receipt";
import { formatHours } from "@/lib/analytics-data";
import { shareInvite } from "@/lib/share-invite";

/** End-of-day "proof of discipline" ticket built from local history (works offline). */
export function DailyReceipt({ sessions }: { sessions: Session[] }) {
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const day = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - offset); return d; }, [offset]);
  const r = useMemo(() => buildDailyReceipt(sessions, day), [sessions, day]);
  const peak = Math.max(30, ...r.hours);
  const dateLabel = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const share = async () => {
    const text = [
      `CommitX Daily Receipt · ${dateLabel}`,
      `Locked in: ${formatHours(r.lockedMinutes)}`,
      `Sessions kept: ${r.completed} · Quit: ${r.forfeited}`,
      r.discipline !== null ? `Discipline: ${r.discipline}%` : null,
      `Verdict: ${r.verdict}`,
      `#${r.receiptId}`,
    ].filter(Boolean).join("\n");
    const native = window.CommitXAndroid;
    const res = await shareInvite("My CommitX Receipt", text, "https://commitx.site", {
      nativeShare: native?.shareText ? (t, m) => native.shareText?.(t, m) : undefined,
      webShare: !native && navigator.share ? (d) => navigator.share(d) : undefined,
      copy: navigator.clipboard?.writeText ? (m) => navigator.clipboard.writeText(m) : undefined,
    });
    setNotice(res === "copied" ? "Receipt copied — paste it anywhere." : res === "unavailable" ? "Sharing isn't available here." : null);
  };

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold tabular-nums text-foreground">{v}</span>
    </div>
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <ReceiptIcon className="h-4 w-4" /> Daily receipt
        </p>
        <div className="flex items-center gap-1">
          <button aria-label="Previous day" onClick={() => setOffset((o) => Math.min(30, o + 1))} className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next day" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="cx-receipt relative mx-auto max-w-sm overflow-hidden rounded-2xl px-6 pb-6 pt-7 font-mono text-[13px]">
        <div className="text-center">
          <p className="text-lg font-bold tracking-[0.3em] text-foreground">COMMITX</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Proof of discipline</p>
          <p className="mt-3 text-[11px] text-muted-foreground">{dateLabel}</p>
        </div>

        <div className="cx-receipt-cut my-4" />

        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Time locked in</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-primary">{formatHours(r.lockedMinutes)}</p>
        </div>

        <div className="mt-4 flex h-10 items-end gap-[2px]" aria-label="Focus by hour">
          {r.hours.map((m, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${m ? Math.max(18, (m / peak) * 100) : 8}%`, background: m ? "var(--color-primary)" : "var(--color-muted)" }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>

        <div className="cx-receipt-cut my-4" />

        <Row k="Sessions kept" v={String(r.completed)} />
        <Row k="Sessions quit" v={String(r.forfeited)} />
        <Row k="Verified sessions" v={String(r.verified)} />
        <Row k="Longest block" v={formatHours(r.longestMinutes)} />
        <Row k="Discipline" v={r.discipline === null ? "—" : `${r.discipline}%`} />
        <Row k="Cx Coins earned" v={`+${r.coinsEarned}`} />

        <div className="cx-receipt-cut my-4" />

        <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Verdict</p>
        <p className="mt-1 text-center text-base font-bold tracking-wider text-foreground">{r.verdict}</p>

        <div className="mt-5 flex h-8 items-stretch justify-center gap-[2px]" aria-hidden>
          {r.receiptId.split("").flatMap((c, i) => {
            const n = c.charCodeAt(0);
            return [<span key={i} className="bg-foreground" style={{ width: (n % 3) + 1 }} />, <span key={`g${i}`} style={{ width: (n % 2) + 1 }} />];
          })}
        </div>
        <p className="mt-2 text-center text-[10px] tracking-[0.2em] text-muted-foreground">#{r.receiptId}</p>
      </div>

      <button onClick={share} className="mx-auto mt-4 flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-soft">
        <Share2 className="h-4 w-4" /> Share my receipt
      </button>
      {notice && <p className="mt-2 text-center text-xs text-muted-foreground">{notice}</p>}
    </section>
  );
}
