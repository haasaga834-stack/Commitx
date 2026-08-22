import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  Check,
  Copy,
  Play,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Hourglass } from "@/components/Hourglass";
import { WindScape } from "@/components/WindScape";
import { formatINR } from "@/lib/commitx-store";
import {
  cancelGroup,
  getGroupState,
  setMyGroupOutcome,
  startGroup,
} from "@/lib/group-study.functions";
import {
  MAX_GROUP_SIZE,
  memberStatusLabel,
  recordGroupOutcome,
  type GroupStateDTO,
} from "@/lib/group-study";
import { setNativeSessionLock } from "@/lib/native-session";
import { showSessionProgress, hideSessionProgress } from "@/lib/native-notifications";
import { useIsTablet } from "@/lib/use-tablet";
import { GroupLobbyTablet } from "@/components/GroupLobbyTablet";

export const Route = createFileRoute("/group/$id")({
  head: () => ({
    meta: [
      { title: "CommitX — Group session" },
      {
        name: "description",
        content: "One shared timer. Everyone commits, everyone finishes together.",
      },
      { property: "og:title", content: "CommitX — Group session" },
      {
        property: "og:description",
        content: "One shared timer. Everyone commits, everyone finishes together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <Fallback text="We couldn't load this group. It may have been cancelled." />
  ),
  notFoundComponent: () => <Fallback text="This group no longer exists." />,
  component: GroupSession,
});

function Fallback({ text }: { text: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to="/group"
        className="mt-5 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Back to Group Study
      </Link>
    </div>
  );
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** Verified group sessions allow a short absence (emergency calls). */
const VERIFIED_GRACE_MS = 60_000;

function GroupSession() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const fetchState = useServerFn(getGroupState);
  const start = useServerFn(startGroup);
  const finish = useServerFn(setMyGroupOutcome);
  const drop = useServerFn(cancelGroup);

  const [data, setData] = useState<GroupStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Errors from lobby actions stay inline; they must not replace the screen. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /** serverNow - clientNow, so the shared clock is authoritative. */
  const skewRef = useRef(0);
  const doneRef = useRef(false);
  const graceRef = useRef<number | null>(null);

  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchState({ data: { id } });
      skewRef.current = next.serverNow - Date.now();
      hasDataRef.current = true;
      setData(next);
      setOffline(false);
      setError(null);
      return next;
    } catch (e) {
      // A temporary disconnect must never kill the timer — keep the last
      // known state and keep retrying.
      if (hasDataRef.current) setOffline(true);
      else setError(e instanceof Error ? e.message : "Group not found.");
      return null;
    }
  }, [fetchState, id]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
    const poll = window.setInterval(() => void loadRef.current(), 3000);
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [id]);

  const group = data?.group ?? null;
  const me = data?.me ?? null;
  const isActive = group?.status === "active";
  const isVerified = group?.mode === "verified";
  const endsAt = group?.ends_at ? Date.parse(group.ends_at) : null;
  const serverTime = now + skewRef.current;
  const remainingMs = endsAt ? Math.max(0, endsAt - serverTime) : null;
  const totalMs = (group?.duration_minutes ?? 0) * 60_000;
  const progress =
    remainingMs !== null && totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const stillIn = me?.status === "committed" || me?.status === "joined";

  /** Native lock + progress notification while the shared timer runs. */
  useEffect(() => {
    if (!isActive || !stillIn) return;
    setNativeSessionLock(isVerified);
    return () => setNativeSessionLock(false);
  }, [isActive, stillIn, isVerified]);

  useEffect(() => {
    if (!isActive || !stillIn || remainingMs === null || !group) return;
    showSessionProgress(
      fmt(remainingMs / 1000),
      `${group.goal} · group session`,
      Math.min(100, Math.max(0, progress * 100)),
    );
  }, [isActive, stillIn, remainingMs, progress, group]);

  useEffect(() => () => hideSessionProgress(), []);

  const settle = useCallback(
    (status: "completed" | "failed", reason?: string) => {
      if (doneRef.current || !group) return;
      doneRef.current = true;
      setNativeSessionLock(false);
      hideSessionProgress();
      recordGroupOutcome({
        goal: group.goal,
        duration: group.duration_minutes,
        value: group.commit_value,
        mode: group.mode,
        status,
      });
      void finish({
        data: { id, status: status === "completed" ? "completed" : "failed" },
      }).catch(() => {});
      navigate({
        to: status === "completed" ? "/success" : "/failed",
        search: {
          goal: group.goal,
          duration: String(group.duration_minutes),
          value: String(group.commit_value),
          ...(reason ? { reason } : {}),
        } as Record<string, string>,
      });
    },
    [finish, group, id, navigate],
  );

  /** Timer finished on the server clock → everyone who stayed succeeds. */
  useEffect(() => {
    if (!isActive || !stillIn || remainingMs === null) return;
    if (remainingMs <= 0) settle("completed");
  }, [isActive, stillIn, remainingMs, settle]);

  /** Verified enforcement: leaving the app fails this participant. */
  useEffect(() => {
    if (!isActive || !stillIn || !isVerified) return;

    const clearGrace = () => {
      if (graceRef.current) window.clearTimeout(graceRef.current);
      graceRef.current = null;
    };

    const onHidden = () => {
      if (graceRef.current) return;
      graceRef.current = window.setTimeout(
        () => settle("failed", "app_switch"),
        VERIFIED_GRACE_MS,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") clearGrace();
      else onHidden();
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) settle("failed", "browser_unload");
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearGrace();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isActive, stillIn, isVerified, settle]);

  if (error) return <Fallback text={error} />;
  if (!group) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading group…</p>
      </div>
    );
  }

  const active = data!.members.filter((m) => m.status !== "left");
  const canStart = active.length >= 2;

  const copyCode = () => {
    try {
      void navigator.clipboard?.writeText(group.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await start({ data: { id } });
      // Flip locally right away so the shared timer shows without waiting
      // for the next poll, then reconcile with the server.
      setData((prev) =>
        prev
          ? {
              ...prev,
              group: {
                ...prev.group,
                status: "active",
                started_at: res.started_at,
                ends_at: res.ends_at,
              },
              members: prev.members.map((m) =>
                m.status === "committed" ? { ...m, status: "joined" } : m,
              ),
              me:
                prev.me && prev.me.status === "committed"
                  ? { ...prev.me, status: "joined" }
                  : prev.me,
            }
          : prev,
      );
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    try {
      await drop({ data: { id } });
    } catch {}
    navigate({ to: "/group" });
  };

  /* ------------------------------- Lobby ------------------------------- */
  if (!isActive) {
    if (isTablet) {
      return (
        <GroupLobbyTablet
          group={group}
          members={data!.members}
          isCreator={data!.isCreator}
          copied={copied}
          onCopy={copyCode}
          busy={busy}
          canStart={canStart}
          onStart={onStart}
          onCancel={onCancel}
          actionError={actionError}
        />
      );
    }
    return (
      <div className="min-h-screen pb-16">
        <div className="mx-auto max-w-md px-6 pt-14">
          <div className="flex items-center justify-between">
            <Link
              to="/group"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {group.status === "ended" ? "Session finished" : "Waiting room"}
            </p>
            <div className="w-10" />
          </div>

          <h1 className="mt-4 text-center font-display text-3xl font-semibold">{group.goal}</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {group.duration_minutes} minutes · {formatINR(group.commit_value)} each ·{" "}
            {group.mode === "verified" ? "Verified" : "Standard"}
          </p>

          {/* Invite */}
          <section className="mt-6 rounded-3xl border border-hairline bg-card p-5 shadow-soft">
            <h2 className="font-display text-base font-semibold">Invite friends</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this code. Friends accept the terms and commit the same amount to
              join. Max {MAX_GROUP_SIZE} people.
            </p>
            <button
              onClick={copyCode}
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-hairline bg-background px-4 py-3.5"
            >
              <span className="font-display text-2xl font-semibold tracking-[0.3em] text-foreground">
                {group.code}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </span>
            </button>
          </section>

          {/* Participants */}
          <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Participants</h2>
              <span className="text-[11px] text-muted-foreground">
                {active.length} / {MAX_GROUP_SIZE}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-hairline">
              {data!.members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {m.display_name}
                      {m.role === "creator" ? " · host" : ""}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {memberStatusLabel(m.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {group.status === "ended" ? (
            <p className="mt-6 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-muted-foreground">
              This group session has finished.
            </p>
          ) : data!.isCreator ? (
            <>
              {!canStart && (
                <p className="mt-6 rounded-2xl bg-foreground/5 px-4 py-3 text-xs text-muted-foreground">
                  At least one friend must join before you can start.
                </p>
              )}
              {actionError && (
                <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                  {actionError}
                </p>
              )}
              <button
                onClick={onStart}
                disabled={busy || !canStart}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {busy ? "Starting…" : "Start group session"}
              </button>
              <button
                onClick={onCancel}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3.5 text-sm font-medium text-secondary-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Cancel group
              </button>
            </>
          ) : (
            <p className="mt-7 rounded-2xl bg-accent/10 px-4 py-3.5 text-sm text-primary">
              You're committed. The host starts the shared timer — keep this screen
              open.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* --------------------------- Shared session --------------------------- */
  if (!stillIn) {
    return (
      <Fallback
        text={
          me?.status === "completed"
            ? "You finished this group session."
            : "You're no longer part of this running session."
        }
      />
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background px-6 pb-10 pt-14">
      <WindScape fixed={false} className="z-0" />
      <div className="relative z-10 flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Group {isVerified ? "verified" : "standard"} session
        </p>
        <button
          onClick={() => setConfirmLeave(true)}
          className="absolute right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
          aria-label="Leave session"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 md:landscape:flex-row md:landscape:gap-14">
        <div className="shrink-0">
          <Hourglass size={260} state="running" progress={progress} />
        </div>
        <div className="flex min-w-0 flex-col items-center md:landscape:items-start">
          <p className="font-display text-6xl font-semibold tabular-nums tracking-tight">
            {fmt((remainingMs ?? 0) / 1000)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{group.goal}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatINR(group.commit_value)} committed each
          </p>
          {isVerified && (
            <p className="mt-5 flex items-center gap-1.5 rounded-full bg-foreground/5 px-4 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Leaving CommitX fails you
            </p>
          )}
          {offline && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Reconnecting… the shared timer keeps running.
            </p>
          )}
        </div>
      </div>

      {/* Live participants */}
      <div className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-hairline bg-card p-4 shadow-soft">
        <ul className="grid gap-2">
          {data!.members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  m.status === "joined"
                    ? "bg-primary"
                    : m.status === "completed"
                      ? "bg-accent"
                      : "bg-muted-foreground/40"
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {m.display_name}
                {m.role === "creator" ? " · host" : ""}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {memberStatusLabel(m.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-4xl bg-card p-6 pb-10 shadow-lift">
            <h2 className="font-display text-xl font-semibold">Leave the group?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Leaving before the shared timer finishes loses your{" "}
              {formatINR(group.commit_value)} commitment. Your friends keep going.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
              >
                Keep focusing
              </button>
              <button
                onClick={() => settle("failed", "quit")}
                className="rounded-2xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
