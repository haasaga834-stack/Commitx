import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { DurationWheel } from "@/components/DurationWheel";
import { ThemePicker } from "@/components/ThemePicker";
import type { SessionThemeId } from "@/lib/session-themes";
import { formatDuration } from "@/lib/planner";
import { coinLabel, MIN_COMMIT, MAX_COMMIT, useAppState } from "@/lib/commitx-store";
import { createGroup, joinGroup, previewInvite } from "@/lib/group-study.functions";
import type { InvitePreviewDTO } from "@/lib/group-study.shared";
import { useAuth } from "@/lib/use-auth";
import { actionErrorMessage, isOnline, OFFLINE_ACTION_MESSAGE } from "@/lib/connectivity";

type Step = "choice" | "duration" | "coins" | "mode" | "code" | "terms";

/**
 * Website entry into the existing Group Study flow: pick create or join, set
 * the terms in small steps, then hand over to the unchanged /group/$id lobby
 * where the code and the waiting room live.
 */
export function GroupSetup({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const { state } = useAppState();
  const create = useServerFn(createGroup);
  const join = useServerFn(joinGroup);
  const preview = useServerFn(previewInvite);

  const [step, setStep] = useState<Step>("choice");
  const [duration, setDuration] = useState(60);
  const [value, setValue] = useState(MIN_COMMIT);
  const [mode, setMode] = useState<"standard" | "verified">("standard");
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState<InvitePreviewDTO | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;

  const maxStake = Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, state.coins));
  const canStake = state.coins >= MIN_COMMIT;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onCreate(theme: SessionThemeId) {
    if (busy) return;
    if (!isOnline()) {
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        data: { goal: "Group Study", duration, value, mode, theme },
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setThemeOpen(false);
      onClose();
      navigate({ to: "/group/$id", params: { id: res.id } });
    } catch (e) {
      setError(actionErrorMessage(e, "Could not create the group."));
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    if (busy || code.trim().length < 4) return;
    if (!isOnline()) {
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    setAccepted(false);
    try {
      const res = await preview({ data: { code: code.trim() } });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTerms(res);
      setStep("terms");
    } catch (e) {
      setError(actionErrorMessage(e, "That invite code doesn't exist."));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (busy || !terms || !accepted) return;
    if (!isOnline()) {
      setError(OFFLINE_ACTION_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await join({ data: { code: code.trim(), acceptedTerms: true } });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onClose();
      navigate({ to: "/group/$id", params: { id: res.id } });
    } catch (e) {
      setError(actionErrorMessage(e, "Could not join this group."));
    } finally {
      setBusy(false);
    }
  }

  const primary =
    "group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ink px-7 py-4 text-sm font-medium text-paper transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0 disabled:opacity-50";
  const back = (to: Step) => (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setStep(to);
      }}
      className="mt-4 w-full text-center text-xs text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-ink"
    >
      Back
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Group study setup"
      onClick={(e) => {
        // Only a tap on the backdrop itself closes the setup. Taps inside the
        // theme sheet (rendered within this tree) must never close it, and the
        // setup must stay open while a group is being saved.
        if (e.target !== e.currentTarget || busy || themeOpen) return;
        onClose();
      }}
    >
      <div
        className="animate-landing-modal w-full max-w-md rounded-t-[28px] bg-paper p-7 pb-10 shadow-lift sm:rounded-[28px] sm:p-8 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
            Group Study
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!signedIn ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              Sign in to study with friends
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              Group sessions share one timer and one commitment, so they need an account.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate({ to: "/auth" });
              }}
              className={primary}
            >
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </>
        ) : step === "choice" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              Study with your loved ones
            </h2>
            <div className="mt-6 grid gap-2.5">
              <button
                type="button"
                onClick={() => setStep("duration")}
                className="rounded-2xl border border-ink-line px-5 py-4 text-left transition-colors hover:border-ink/30"
              >
                <p className="text-sm font-medium text-ink">Create a group</p>
                <p className="mt-1 text-xs text-ink-soft">
                  You set the time and the commitment, then share the code.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStep("code")}
                className="rounded-2xl border border-ink-line px-5 py-4 text-left transition-colors hover:border-ink/30"
              >
                <p className="text-sm font-medium text-ink">Join with a code</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Enter the code a friend shared with you.
                </p>
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </>
        ) : step === "duration" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              How long will the group focus?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">{formatDuration(duration)}</p>
            <div className="mt-4">
              <DurationWheel value={duration} onChange={setDuration} />
            </div>
            <button type="button" onClick={() => setStep("coins")} className={primary}>
              Continue
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            {back("choice")}
          </>
        ) : step === "coins" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              Commit Cx Coins
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Everyone who joins commits the same amount.
            </p>
            <div className="mt-5 rounded-2xl border border-ink-line p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-soft">Each member commits</span>
                <span className="font-medium text-ink">{coinLabel(Math.min(value, maxStake))}</span>
              </div>
              {canStake ? (
                <input
                  type="range"
                  min={MIN_COMMIT}
                  max={maxStake}
                  step={10}
                  value={Math.min(value, maxStake)}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="mt-3 w-full accent-current"
                  aria-label="Cx Coins to commit"
                />
              ) : null}
              <p className="mt-2 text-xs text-ink-soft">
                Balance {coinLabel(state.coins)} · Finish together to get them back.
              </p>
            </div>
            <button
              type="button"
              disabled={!canStake}
              onClick={() => setStep("mode")}
              className={primary}
            >
              {canStake ? "Continue" : `Need ${coinLabel(MIN_COMMIT)} to create`}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            {back("duration")}
          </>
        ) : step === "mode" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              Standard or Verified?
            </h2>
            <div className="mt-6 grid gap-2.5">
              {(
                [
                  {
                    id: "standard" as const,
                    title: "Standard",
                    sub: "Stay in the session. Leaving early loses the commitment.",
                  },
                  {
                    id: "verified" as const,
                    title: "Verified",
                    sub: "Strict. Leaving the page ends the session immediately.",
                  },
                ]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  className={cn(
                    "rounded-2xl border px-5 py-4 text-left transition-colors",
                    mode === m.id
                      ? "border-ink bg-ink/5"
                      : "border-ink-line hover:border-ink/30",
                  )}
                >
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">{m.sub}</p>
                </button>
              ))}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <button type="button" disabled={busy} onClick={() => setThemeOpen(true)} className={primary}>
              Choose theme
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            {back("coins")}
          </>
        ) : step === "code" ? (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              Enter the group code
            </h2>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={12}
              autoFocus
              className="mt-5 w-full rounded-2xl border border-ink-line bg-paper px-4 py-3.5 text-center text-lg font-medium tracking-[0.25em] text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink/40"
            />
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <button
              type="button"
              disabled={busy || code.trim().length < 4}
              onClick={onPreview}
              className={primary}
            >
              {busy ? "Checking…" : "Continue"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            {back("choice")}
          </>
        ) : (
          <>
            <h2 className="mt-5 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              {terms?.creator_name ?? "A friend"}'s group
            </h2>
            <div className="mt-5 space-y-2 rounded-2xl border border-ink-line p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Focus time</span>
                <span className="font-medium text-ink">
                  {formatDuration(terms?.duration_minutes ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Mode</span>
                <span className="font-medium text-ink">
                  {terms?.mode === "verified" ? "Verified" : "Standard"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Your commitment</span>
                <span className="font-medium text-ink">{coinLabel(terms?.commit_value ?? 0)}</span>
              </div>
              {terms?.running && terms.minutes_left ? (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Already running</span>
                  <span className="font-medium text-ink">{terms.minutes_left} min left</span>
                </div>
              ) : null}
            </div>
            <label className="mt-4 flex items-start gap-3 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-current"
              />
              <span>
                I commit {coinLabel(terms?.commit_value ?? 0)} and understand I lose them if I leave
                early.
              </span>
            </label>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <button
              type="button"
              disabled={busy || !accepted}
              onClick={onJoin}
              className={primary}
            >
              {busy ? "Joining…" : "Accept and join"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            {back("code")}
          </>
        )}
      </div>
      <ThemePicker
        open={themeOpen}
        starting={busy}
        confirmLabel="Create group"
        title="Choose the group's mood"
        subtitle="Everyone in this group studies inside the scene you pick."
        error={themeOpen ? error : null}
        busyLabel="Creating group…"
        onCancel={() => {
          if (busy) return;
          setThemeOpen(false);
        }}
        onConfirm={(theme) => void onCreate(theme)}
      />
    </div>
  );
}
