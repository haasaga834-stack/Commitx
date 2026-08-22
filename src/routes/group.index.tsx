import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clock,
  LogOut,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TabletShell } from "@/components/TabletShell";
import { useIsTablet } from "@/lib/use-tablet";
import { ThemePicker } from "@/components/ThemePicker";
import type { SessionThemeId } from "@/lib/session-themes";
import { formatINR, MIN_COMMIT, MAX_COMMIT, useAppState } from "@/lib/commitx-store";
import {
  createGroup,
  cancelGroup,
  getMyOpenGroup,
  joinGroup,
  leaveLobby,
  listMyGroups,
  previewInvite,
} from "@/lib/group-study.functions";
import { MAX_GROUP_SIZE, type GroupDTO, type InvitePreviewDTO } from "@/lib/group-study.shared";

export const Route = createFileRoute("/group/")({
  head: () => ({
    meta: [
      { title: "CommitX — Group Study" },
      {
        name: "description",
        content:
          "Create a group, commit together and share one timer. Anyone who leaves early loses their commitment.",
      },
      { property: "og:title", content: "CommitX — Group Study" },
      {
        property: "og:description",
        content: "Pick a time, commit together, and see who makes it to the finish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupIndex,
});

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function GroupIndex() {
  const isTablet = useIsTablet();
  const navigate = useNavigate();
  const { state, hydrated } = useAppState();
  const create = useServerFn(createGroup);
  const cancel = useServerFn(cancelGroup);
  const join = useServerFn(joinGroup);
  const leave = useServerFn(leaveLobby);
  const preview = useServerFn(previewInvite);
  const mine = useServerFn(listMyGroups);
  const openGroupFn = useServerFn(getMyOpenGroup);

  const [duration, setDuration] = useState(60);
  const [value, setValue] = useState(MIN_COMMIT);
  const [mode, setMode] = useState<"standard" | "verified">("standard");
  const [busy, setBusy] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [terms, setTerms] = useState<InvitePreviewDTO | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [openGroup, setOpenGroup] = useState<{
    id: string;
    code: string;
    status: string;
    isHost: boolean;
  } | null>(null);
  const [removingOpenGroup, setRemovingOpenGroup] = useState(false);

  const refresh = useCallback(() => {
    mine({})
      .then((rows) => setGroups(rows))
      .catch(() => {});
    openGroupFn({})
      .then((g) => setOpenGroup(g))
      .catch(() => {});
  }, [mine, openGroupFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** A blocked create/join always means one open group — surface the way back. */
  const recoverOpenGroup = useCallback(async () => {
    try {
      const g = await openGroupFn({});
      setOpenGroup(g);
      return g;
    } catch {
      return null;
    }
  }, [openGroupFn]);

  /** Hosts pick the shared ambience before the group is created. */
  function onCreate() {
    if (busy || openGroup) return;
    setError(null);
    setThemeOpen(true);
  }

  async function createWithTheme(theme: SessionThemeId) {
    if (busy || openGroup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        data: { goal: "Group Study", duration, value, mode, theme },
      });
      if ("error" in res) {
        setError(res.error);
        await recoverOpenGroup();
        return;
      }
      navigate({ to: "/group/$id", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the group.");
      await recoverOpenGroup();
    } finally {
      setBusy(false);
      setThemeOpen(false);
    }
  }

  async function onPreview() {
    if (busy || code.trim().length < 4) return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "That invite code doesn't exist.");
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptAndCommit() {
    if (busy || !terms || !accepted) return;
    setBusy(true);
    setError(null);
    try {
      const res = await join({ data: { code: code.trim(), acceptedTerms: true } });
      if ("error" in res) {
        setError(res.error);
        const g = await recoverOpenGroup();
        if (g) setTerms(null);
        return;
      }
      setTerms(null);
      navigate({ to: "/group/$id", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this group.");
      const g = await recoverOpenGroup();
      if (g) setTerms(null);
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveOpenGroup() {
    if (!openGroup || busy || removingOpenGroup || openGroup.status === "active") return;
    setRemovingOpenGroup(true);
    setError(null);
    try {
      if (openGroup.isHost) {
        await cancel({ data: { id: openGroup.id } });
      } else {
        await leave({ data: { id: openGroup.id } });
      }
      setOpenGroup(null);
      setGroups((current) => current.filter((group) => group.id !== openGroup.id));
      setTerms(null);
      setAccepted(false);
      await Promise.all([
        mine({}).then((rows) => setGroups(rows)),
        openGroupFn({}).then((group) => setOpenGroup(group)),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : openGroup.isHost
            ? "Could not cancel the group."
            : "Could not leave the group.",
      );
      await recoverOpenGroup();
    } finally {
      setRemovingOpenGroup(false);
    }
  }

  const header = (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Group study</p>
        <div className="w-10" />
      </div>

      <h1
        className={cn("mt-8 font-display text-3xl font-semibold", isTablet && "mt-6 text-[2rem]")}
      >
        Lock in with your people. 🎯
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick a time, commit together, and see who makes it to the finish.
      </p>
    </div>
  );

  const unfinishedCard = openGroup ? (
    <section className="rounded-3xl border border-primary/40 bg-card p-5 shadow-soft">
      <h2 className="font-display text-base font-semibold">You have an unfinished group</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {openGroup.status === "active"
          ? "Your group session is running — jump back in to keep your commitment."
          : `Waiting in the lobby · code ${openGroup.code}`}
        {openGroup.isHost ? " · you're the host" : ""}
      </p>
      <div className="mt-4 grid gap-2.5">
        <Link
          to="/group/$id"
          params={{ id: openGroup.id }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-soft"
        >
          {openGroup.status === "active" ? "Rejoin session" : "Open lobby"}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {openGroup.status !== "active" && (
          <button
            type="button"
            onClick={() => void onRemoveOpenGroup()}
            disabled={busy || removingOpenGroup}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {openGroup.isHost ? (
              <Trash2 className="h-4 w-4 text-destructive" />
            ) : (
              <LogOut className="h-4 w-4 text-destructive" />
            )}
            {removingOpenGroup
              ? openGroup.isHost
                ? "Cancelling…"
                : "Leaving…"
              : openGroup.isHost
                ? "Cancel unfinished group"
                : "Leave unfinished group"}
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {openGroup.status === "active"
          ? "One group at a time — finish this running session before starting another."
          : "Cancel or leave this lobby to create or join a different group."}
      </p>
    </section>
  ) : null;

  const groupsCard =
    groups.length > 0 ? (
      <section className="rounded-3xl border border-hairline bg-card p-5 shadow-soft">
        <h2 className="font-display text-base font-semibold">Your groups</h2>
        <ul className="mt-3 divide-y divide-hairline">
          {groups.map((g) => (
            <li key={g.id}>
              <Link to="/group/$id" params={{ id: g.id }} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {g.goal} · {fmtDuration(g.duration_minutes)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatINR(g.commit_value)} each ·{" "}
                    {g.mode === "verified" ? "Verified" : "Standard"} ·{" "}
                    {g.status === "active" ? "Running" : "Waiting"}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const createCard = (
    <section
      className={cn(
        "rounded-3xl border border-hairline bg-card p-5 shadow-soft",
        isTablet && "p-6",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
          <Users className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">Create a group</h2>
          <p className="text-[11px] text-muted-foreground">
            You + up to 4 friends ({MAX_GROUP_SIZE} max)
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <Label>Duration</Label>
          <span className="font-display text-xl font-semibold text-primary tabular-nums">
            {fmtDuration(duration)}
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={360}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="mt-3 w-full accent-[color:var(--color-primary)]"
        />
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <Label>Commitment each</Label>
          <span className="text-[11px] text-muted-foreground">
            {formatINR(MIN_COMMIT)} – {formatINR(MAX_COMMIT)}
          </span>
        </div>
        <div className="mt-3 flex items-center rounded-2xl border border-hairline bg-background px-4 py-3">
          <span className="text-muted-foreground">₹</span>
          <input
            type="number"
            min={MIN_COMMIT}
            max={MAX_COMMIT}
            value={value}
            onChange={(e) =>
              setValue(
                Math.min(MAX_COMMIT, Math.max(MIN_COMMIT, Math.round(Number(e.target.value) || 0))),
              )
            }
            className="ml-2 w-full bg-transparent text-lg font-medium outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Demo balance: {hydrated ? formatINR(state.balances.demo) : "—"}
        </p>
      </div>

      <div className="mt-5">
        <Label>Session type</Label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["standard", "verified"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm transition-all",
                mode === m ? "border-primary bg-card shadow-lift" : "border-hairline bg-background",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium capitalize">
                {m === "verified" ? (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Clock className="h-4 w-4 text-primary" />
                )}
                {m}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {m === "verified"
                  ? "Leaving the app fails you"
                  : "Flexible, leaving early fails you"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <button
        onClick={onCreate}
        disabled={busy || !!openGroup}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {openGroup
          ? "Finish your current group first"
          : busy
            ? "Working…"
            : "Create group & invite friends"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );

  const joinCard = (
    <section className="rounded-3xl border border-hairline bg-card p-5 shadow-soft">
      <h2 className="font-display text-base font-semibold">Join with a code</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Got an invite? Enter the 6-character code to see the terms.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          className="min-w-0 flex-1 rounded-2xl border border-hairline bg-background px-4 py-3 text-base font-semibold uppercase tracking-widest outline-none focus:border-primary"
        />
        <button
          onClick={onPreview}
          disabled={busy || !!openGroup || code.trim().length < 4}
          className="shrink-0 rounded-2xl bg-secondary px-5 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          View
        </button>
      </div>
    </section>
  );

  const page = (
    <div className={cn("min-h-screen pb-16", isTablet && "min-h-0 pb-0")}>
      {isTablet ? (
        <div className="mx-auto w-full max-w-5xl">
          {header}
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6">
            <div className="flex flex-col gap-6">
              {unfinishedCard}
              {joinCard}
              {groupsCard}
            </div>
            <div className="flex flex-col gap-6">{createCard}</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-14">
          {header}
          {unfinishedCard}
          {groupsCard}
          {createCard}
          {joinCard}
        </div>
      )}

      {/* Terms sheet — a friend must accept and commit before joining */}
      {terms && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm md:items-center md:p-8">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-4xl bg-card p-6 pb-10 shadow-lift md:rounded-4xl md:p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold">
              {terms.creator_name} invited you
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the terms carefully. Joining commits your money.
            </p>

            <dl className="mt-4 divide-y divide-hairline rounded-2xl border border-hairline bg-background px-4">
              <Row label="Duration" value={fmtDuration(terms.duration_minutes)} />
              <Row label="Commitment" value={formatINR(terms.commit_value)} />
              <Row
                label="Session type"
                value={terms.mode === "verified" ? "Verified" : "Standard"}
              />
              <Row label="Group" value={`${terms.member_count} / ${MAX_GROUP_SIZE} joined`} />
            </dl>

            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                `You commit exactly ${formatINR(terms.commit_value)} — the same as everyone else.`,
                "One shared timer runs for the whole group.",
                "If you leave, exit or abandon before the timer finishes, you lose your commitment.",
                terms.mode === "verified"
                  ? "Verified: leaving CommitX during the session fails you immediately."
                  : "Standard: your phone stays flexible, but leaving the session early still fails you.",
                "Stay until the end and your commitment is returned in full.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {t}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setAccepted((a) => !a)}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-hairline bg-background px-4 py-3 text-left"
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  accepted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-hairline",
                )}
              >
                {accepted && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="text-sm text-foreground">
                I accept the terms and commit {formatINR(terms.commit_value)}.
              </span>
            </button>

            {error && (
              <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setTerms(null);
                  setAccepted(false);
                }}
                className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                onClick={onAcceptAndCommit}
                disabled={!accepted || busy || terms.full || terms.status !== "lobby"}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {terms.full
                  ? "Group full"
                  : terms.status !== "lobby"
                    ? "Already started"
                    : "Accept & commit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return isTablet ? <TabletShell>{page}</TabletShell> : page;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
