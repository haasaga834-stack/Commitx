import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Copy, HeartHandshake, Share2, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { buddyInviteUrl, useStudyBuddy } from "@/lib/study-buddy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shareInvite } from "@/lib/share-invite";
import { BuddyFinder, BuddyRequests } from "@/components/BuddyFinder";

function remainingLabel(endsAt: number | null, now: number) {
  if (!endsAt) return "";
  const m = Math.max(0, Math.ceil((endsAt - now) / 60000));
  return `${m}m left`;
}

/** Home card: invite one study buddy, then see their live status and nudge them. */
export function BuddyCard() {
  const { user } = useAuth();
  const buddy = useStudyBuddy(Boolean(user));
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"find" | "code">("find");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // A code saved from an invite link opened while signed out.
  useEffect(() => {
    if (!buddy.status || buddy.status.buddyId) return;
    try {
      const pending = localStorage.getItem("commitx-pending-buddy");
      if (pending) {
        localStorage.removeItem("commitx-pending-buddy");
        setCode(pending);
      }
    } catch {}
  }, [buddy.status]);

  if (!user || !buddy.status) return null;
  const s = buddy.status;
  const hasBuddy = Boolean(s.buddyId);
  const first = s.name?.split(" ")[0] ?? "Buddy";
  const statusLine = !hasBuddy
    ? "Find a study partner or invite a friend."
    : s.focusing
      ? `Focusing${s.goal ? ` on ${s.goal}` : ""} · ${remainingLabel(s.endsAt, now)}`
      : s.todayMinutes > 0
        ? `Idle · ${Math.floor(s.todayMinutes / 60) ? `${Math.floor(s.todayMinutes / 60)}h ` : ""}${s.todayMinutes % 60}m today`
        : "Idle · no study yet today";

  const share = async () => {
    if (!s.pendingCode) return;
    const url = buddyInviteUrl(s.pendingCode);
    const text = `Be my CommitX study buddy! We'll see each other's sessions. Code ${s.pendingCode}.`;
    const native = window.CommitXAndroid;
    const result = await shareInvite("CommitX Study Buddy", text, url, {
      nativeShare: native?.shareText ? (title, message) => native.shareText?.(title, message) : undefined,
      // Older WebViews have no supported share menu: copy instead of a WhatsApp popup.
      webShare: !native && navigator.share ? data => navigator.share(data) : undefined,
      copy: navigator.clipboard?.writeText ? message => navigator.clipboard.writeText(message) : undefined,
    });
    setNotice(result === "copied" ? "Invite copied. Paste it into WhatsApp or any chat."
      : result === "unavailable" ? `Share this code with your friend: ${s.pendingCode}` : null);
  };
  const copy = async () => {
    if (!s.pendingCode) return;
    try {
      await navigator.clipboard.writeText(buddyInviteUrl(s.pendingCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Temporarily paused until the next app release.
          setNotice("Stay tuned! Study Buddy is coming soon.");
          window.setTimeout(() => setNotice(null), 3000);
        }}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-[20px] border border-hairline bg-card px-3 text-left shadow-soft"
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-primary">
          {hasBuddy && s.avatarUrl ? (
            <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <HeartHandshake className="h-5 w-5" />
          )}
          {s.focusing && <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-semibold text-foreground">
            {hasBuddy ? first : "Study Buddy"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{statusLine}</span>
        </span>
        {false && hasBuddy && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Nudge ${first}`}
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await buddy.nudge();
              setNotice(ok ? `Nudge sent to ${first}.` : null);
              if (!ok) setOpen(true);
            }}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary"
          >
            <Bell className="h-3.5 w-3.5" /> Nudge
          </span>
        )}
      </button>
      {notice && <p className="-mt-1 text-center text-[11px] text-primary">{notice}</p>}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-t-4xl bg-card p-6 pb-10 text-center shadow-lift sm:rounded-4xl sm:pb-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-primary">
              <HeartHandshake className="h-6 w-6" />
            </span>
            {hasBuddy ? (
              <>
                <h2 className="mt-4 font-display text-xl font-semibold">{s.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  You both see when the other starts, finishes or gives up a session.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="secondary" className="h-12 rounded-full" onClick={async () => { const ok = await buddy.nudge(); if (ok) setNotice(`Nudge sent to ${first}.`); }}>
                    <Bell className="h-4 w-4" /> Nudge
                  </Button>
                  <Button asChild className="h-12 rounded-full">
                    <Link to="/commit" onClick={() => void buddy.nudge()}>Study together</Link>
                  </Button>
                </div>
                <button type="button" onClick={async () => { if (window.confirm(`Remove ${first} as your study buddy?`)) { await buddy.remove(); setOpen(false); } }} className="mt-5 text-xs text-muted-foreground underline">
                  Remove buddy
                </button>
              </>
            ) : (
              <div className="max-h-[78dvh] overflow-y-auto">
                <h2 className="mt-4 font-display text-xl font-semibold">Get a Study Buddy</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  One buddy. You both see each other's sessions — starts, wins and early quits.
                </p>
                <BuddyRequests onPaired={() => void buddy.reload()} />
                <div className="mt-4 grid grid-cols-2 rounded-full bg-secondary p-1 text-xs font-medium">
                  {(["find", "code"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={`rounded-full py-2 ${tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>
                      {t === "find" ? "Find a buddy" : "Use a code"}
                    </button>
                  ))}
                </div>
                {tab === "find" ? <BuddyFinder /> : (<>
                {s.pendingCode ? (
                  <div className="mt-5 rounded-2xl border border-hairline bg-background p-4">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Your invite code</p>
                    <p className="mt-1 font-display text-3xl font-semibold tracking-[0.3em] text-foreground">{s.pendingCode}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-11 rounded-full" onClick={copy}>
                        <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy link"}
                      </Button>
                      <Button className="h-11 rounded-full" onClick={share}>
                        <Share2 className="h-4 w-4" /> Share
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-5 h-12 w-full rounded-full" onClick={() => void buddy.createInvite()}>
                    Create invite
                  </Button>
                )}
                <div className="mt-5">
                  <p className="text-xs text-muted-foreground">Got a code from a friend?</p>
                  <div className="mt-2 flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" className="h-11 rounded-full text-center tracking-widest" aria-label="Buddy invite code" />
                    <Button className="h-11 shrink-0 rounded-full" disabled={code.length !== 6} onClick={async () => { if (await buddy.acceptCode(code)) setCode(""); }}>
                      Join
                    </Button>
                  </div>
                </div>
                </>)}
              </div>
            )}
            {notice && <p role="status" className="mt-3 text-xs text-primary">{notice}</p>}
            {buddy.error && <p className="mt-3 text-xs text-destructive">{buddy.error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
