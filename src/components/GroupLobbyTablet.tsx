import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Copy, Play, ShieldCheck, Trash2, Users } from "lucide-react";
import { formatINR } from "@/lib/commitx-store";
import { MAX_GROUP_SIZE, memberStatusLabel } from "@/lib/group-study.shared";
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
  actionError: string | null;
}

/**
 * Tablet-only waiting room: a balanced two-column composition instead of a
 * stretched mobile column. All behaviour comes from the route.
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
  actionError,
}: Props) {
  const present = members.filter((m) => m.status !== "left");
  const others = present.length - 1;

  return (
    <div className="min-h-screen pb-16">
      <div className="mx-auto w-full max-w-5xl px-10 pt-12 lg:px-16">
        <div className="flex items-center gap-4">
          <Link
            to="/group"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {group.status === "ended" ? "Session finished" : "Waiting room"}
          </p>
        </div>

        <header className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="font-display text-5xl font-semibold leading-tight">
              {group.goal}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {group.duration_minutes} minutes · {formatINR(group.commit_value)} each ·{" "}
              {group.mode === "verified" ? "Verified" : "Standard"}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2.5 text-sm text-primary">
            {group.mode === "verified" ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {present.length} / {MAX_GROUP_SIZE} in the room
          </div>
        </header>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-start gap-8">
          {/* Participants */}
          <section className="rounded-4xl border border-hairline bg-card p-8 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Participants</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Everyone commits the same amount before the shared timer starts.
            </p>
            <ul className="mt-6 grid gap-3">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-4 rounded-3xl border border-hairline bg-background px-5 py-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
                    <Users className="h-5 w-5" />
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
              {Array.from({ length: Math.max(0, MAX_GROUP_SIZE - members.length) }).map(
                (_, i) => (
                  <li
                    key={`empty-${i}`}
                    className="flex items-center gap-4 rounded-3xl border border-dashed border-hairline px-5 py-4 text-xs text-muted-foreground"
                  >
                    <span className="h-11 w-11 shrink-0 rounded-full border border-dashed border-hairline" />
                    Open seat
                  </li>
                ),
              )}
            </ul>
          </section>

          {/* Invite + controls */}
          <div className="grid gap-6">
            <section className="rounded-4xl border border-hairline bg-card p-8 shadow-soft">
              <h2 className="font-display text-xl font-semibold">Invite friends</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this code. Friends accept the terms and commit the same amount to
                join. Max {MAX_GROUP_SIZE} people.
              </p>
              <button
                onClick={onCopy}
                className="mt-5 flex w-full items-center justify-between rounded-3xl border border-hairline bg-background px-6 py-5"
              >
                <span className="font-display text-3xl font-semibold tracking-[0.35em] text-foreground">
                  {group.code}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
            </section>

            <section className="rounded-4xl border border-hairline bg-card p-8 shadow-soft">
              {group.status === "ended" ? (
                <p className="rounded-3xl bg-foreground/5 px-5 py-4 text-sm text-muted-foreground">
                  This group session has finished.
                </p>
              ) : isCreator ? (
                <>
                  <h2 className="font-display text-xl font-semibold">Start together</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {others > 0
                      ? `${others} friend${others > 1 ? "s" : ""} committed. Starting begins the shared timer for everyone.`
                      : "At least one friend must join before you can start."}
                  </p>
                  {actionError && (
                    <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                      {actionError}
                    </p>
                  )}
                  <button
                    onClick={onStart}
                    disabled={busy || !canStart}
                    className={cn(
                      "mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]",
                      (busy || !canStart) && "opacity-60",
                    )}
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
                <p className="rounded-3xl bg-accent/10 px-5 py-4 text-sm text-primary">
                  You're committed. The host starts the shared timer — keep this screen
                  open.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
