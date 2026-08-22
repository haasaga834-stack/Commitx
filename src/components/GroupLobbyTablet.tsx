import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Copy, LogOut, Play, ShieldCheck, Trash2, Users } from "lucide-react";
import { formatINR } from "@/lib/commitx-store";
import { MAX_GROUP_SIZE, memberStatusLabel } from "@/lib/group-study";
import type { GroupDTO, GroupMemberDTO } from "@/lib/group-study.shared";
import { cn } from "@/lib/utils";

interface Props {
  group: GroupDTO;
  members: GroupMemberDTO[];
  isCreator: boolean;
  copied: boolean;
  onCopy: () => void;
  busy: boolean;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  onLeave: () => void;
  actionError: string | null;
}

/**
 * Tablet waiting room — a calm, compact two-column composition. Type sizes stay
 * close to the phone UI so nothing feels blown up on a larger screen.
 */
export function GroupLobbyTablet({
  group,
  members,
  isCreator,
  copied,
  onCopy,
  busy,
  canStart,
  onStart,
  onCancel,
  onLeave,
  actionError,
}: Props) {
  const present = members.filter((m) => m.status !== "left");
  const others = present.length - 1;
  const ended = group.status === "ended";

  return (
    <div className="min-h-screen pb-14">
      <div className="mx-auto w-full max-w-3xl px-8 pt-10">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            to="/group"
            aria-label="Back to Group Study"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="truncate text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {ended ? "Session finished" : "Waiting room"}
          </p>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-primary">
            {group.mode === "verified" ? (
              <ShieldCheck className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {present.length}/{MAX_GROUP_SIZE}
          </span>
        </div>

        <header className="mt-7 text-center">
          <h1 className="truncate font-display text-3xl font-semibold">{group.goal}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {group.duration_minutes} minutes · {formatINR(group.commit_value)} each ·{" "}
            {group.mode === "verified" ? "Verified" : "Standard"}
          </p>
        </header>

        <div className="mt-8 grid items-start gap-5 md:grid-cols-2">
          {/* Participants */}
          <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Participants</h2>
              <span className="text-[11px] text-muted-foreground">
                {present.length} / {MAX_GROUP_SIZE}
              </span>
            </div>
            <ul className="mt-4 grid gap-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-2xl bg-background px-3.5 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <Users className="h-3.5 w-3.5" />
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
              {Array.from({ length: Math.max(0, MAX_GROUP_SIZE - members.length) }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-hairline px-3.5 py-2.5 text-xs text-muted-foreground"
                >
                  <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-hairline" />
                  Open seat
                </li>
              ))}
            </ul>
          </section>

          {/* Invite + controls */}
          <div className="grid gap-5">
            <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
              <h2 className="font-display text-base font-semibold">Invite friends</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Share this code. Friends accept the terms and commit the same amount.
              </p>
              <button
                onClick={onCopy}
                className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-background px-4 py-3.5"
              >
                <span className="min-w-0 truncate font-display text-xl font-semibold tracking-[0.28em] text-foreground">
                  {group.code}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
            </section>

            <section className="rounded-3xl border border-hairline bg-card p-6 shadow-soft">
              {ended ? (
                <p className="rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-muted-foreground">
                  This group session has finished.
                </p>
              ) : (
                <>
                  <h2 className="font-display text-base font-semibold">
                    {isCreator ? "Start together" : "You're committed"}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {isCreator
                      ? others > 0
                        ? `${others} friend${others > 1 ? "s" : ""} committed. Starting begins the shared timer for everyone.`
                        : "At least one friend must join before you can start."
                      : "The host starts the shared timer — keep this screen open."}
                  </p>
                  {actionError && (
                    <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                      {actionError}
                    </p>
                  )}
                  {isCreator ? (
                    <>
                      <button
                        onClick={onStart}
                        disabled={busy || !canStart}
                        className={cn(
                          "mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]",
                          (busy || !canStart) && "opacity-60",
                        )}
                      >
                        <Play className="h-4 w-4" />
                        {busy ? "Starting…" : "Start group session"}
                      </button>
                      <button
                        onClick={onCancel}
                        disabled={busy}
                        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancel group
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onLeave}
                      disabled={busy}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      Leave group
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
