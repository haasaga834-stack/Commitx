import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, stats, setState, formatCoins } from "@/lib/commitx-store";
import { useState, useEffect, useMemo, useRef } from "react";
import { Pencil, Check, Trophy, Clock, Camera, ChevronDown, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fileToProfilePhoto } from "@/lib/profile-photo";
import { useOnlineUsers } from "@/lib/presence";
import { refreshFromCloud } from "@/lib/cloud-sync";
import { supabase } from "@/integrations/supabase/client";
import { formatHours } from "@/lib/analytics-data";
import { useLeaderboard } from "@/lib/community";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "CommitX — Profile" },
      { name: "description", content: "Your discipline, in numbers." },
      { property: "og:title", content: "CommitX — Profile" },
      { property: "og:description", content: "Your discipline, in numbers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { state, hydrated } = useAppState();
  const { user } = useAuth();
  const local = stats(state.sessions);
  // The shared store holds all recorded pages plus only pending outcomes.
  // A separate aggregate request cannot race this snapshot or double-count it.
  const s = local;
  const [editing, setEditing] = useState(false);
  const [sexPickerOpen, setSexPickerOpen] = useState(false);
  const [draft, setDraft] = useState(state.profile);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoError, setPhotoError] = useState("");
  const photo = state.profile.photo ?? "";

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const next = await fileToProfilePhoto(file);
      setState((prev) => ({ ...prev, profile: { ...prev.profile, photo: next } }));
    } catch {
      setPhotoError("Couldn't use that image. Try another one.");
    }
  }

  useEffect(() => {
    setDraft(state.profile);
  }, [state.profile]);

  // Opening Profile fetches the latest hours and coins from every device.
  useEffect(() => {
    refreshFromCloud();
  }, []);

  function save() {
    setState((prev) => ({ ...prev, profile: draft }));
    setEditing(false);
  }

  const totalHours =
    s.totalMinutes >= 60
      ? `${Math.floor(s.totalMinutes / 60)}h ${s.totalMinutes % 60}m`
      : `${s.totalMinutes}m`;

  const initials = state.profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  const { rows: cloudLeaders } = useLeaderboard(10);
  const leaderboard = useMemo(
    () => buildLeaderboard(cloudLeaders, state.profile.name, s.totalMinutes, photo || null, user?.id),
    [cloudLeaders, state.profile.name, s.totalMinutes, photo, user?.id],
  );

  const tiles = [
    { label: "Cx Coins", value: hydrated ? formatCoins(state.coins) : "—" },
    { label: "Coins earned", value: formatCoins(s.coinsEarned) },
    { label: "Current streak", value: `${s.streak}d` },
    { label: "Longest streak", value: `${s.longest}d` },
    { label: "Focus hours", value: totalHours },
    { label: "Success rate", value: `${s.successRate}%` },
    { label: "Completed", value: String(s.completed) },
    { label: "Failed", value: String(s.failed) },
  ];

  return (
    <MobileShell>
      <div className="px-5 pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Profile
          </p>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-soft"
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
            <button
              onClick={() => (editing ? save() : setEditing(true))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-soft"
              aria-label={editing ? "Save" : "Edit"}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Identity — one compact card instead of a tall centred stack */}
        <div className="mt-3 flex items-center gap-3.5 rounded-3xl bg-card p-3 shadow-soft">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-2xl font-semibold text-primary-foreground shadow-lift">
              {hydrated && photo ? (
                <img
                  src={photo}
                  alt={`${state.profile.name}'s profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{hydrated ? initials : ""}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-0.5 -right-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-lift"
              aria-label="Change profile photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-hairline bg-background px-3 py-1.5 text-base font-semibold outline-none focus:border-primary"
              />
            ) : (
              <h1 className="truncate font-display text-xl font-semibold">
                {state.profile.name}
              </h1>
            )}
            <div className="mt-1 flex items-center gap-3">
              {photo && (
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, profile: { ...prev.profile, photo: "" } }))}
                  className="text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  Remove photo
                </button>
              )}
              {photoError && (
                <p className="truncate text-xs text-destructive">{photoError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Details — three columns, one slim card */}
        <div className="mt-2.5 grid grid-cols-3 rounded-3xl bg-card py-2.5 shadow-soft">
          <Field
            label="Age"
            value={state.profile.age}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, age: v })}
            draft={draft.age}
          />
          <Button
            variant="ghost"
            onClick={() => setSexPickerOpen(true)}
            aria-label="Select sex"
            className="h-auto min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-none border-l border-hairline px-3 py-0 text-left"
          >
            <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">Sex</span>
            <span className="flex w-full items-center gap-1 text-sm font-medium">
              <span className="min-w-0 break-words">{(editing ? draft.sex : state.profile.sex) || "—"}</span>
              <ChevronDown className="ml-auto shrink-0 text-muted-foreground" />
            </span>
          </Button>
          <Field
            label="Education"
            value={state.profile.education}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, education: v })}
            draft={draft.education}
            divider
          />
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="min-w-0 rounded-3xl bg-card px-4 py-3 shadow-soft"
            >
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.label}
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold tabular-nums">
                {t.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Top 10 · Study Hours
          </p>
          <Trophy className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 space-y-1.5">
          {leaderboard.map((row, i) => (
            <LeaderRow key={row.name + i} rank={i + 1} row={row} />
          ))}
        </div>

        <div className="h-4" />
      </div>
      <Dialog open={sexPickerOpen} onOpenChange={setSexPickerOpen}>
        <DialogContent aria-describedby={undefined} className="w-[calc(100%-2.5rem)] max-w-xs gap-4 rounded-3xl border-0 bg-card p-5 sm:rounded-3xl">
          <DialogTitle className="text-center font-display tracking-normal">Sex</DialogTitle>
          <div className="grid gap-1.5">
            {["Male", "Female", "Prefer not to say"].map((option) => {
              const selected = option === (editing ? draft.sex : state.profile.sex);
              return (
                <Button
                  key={option}
                  variant="ghost"
                  aria-pressed={selected}
                  className={cn("h-11 justify-between rounded-xl px-4", selected ? "bg-primary/10 text-primary" : "bg-background text-foreground")}
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, sex: option }));
                    if (!editing) setState((prev) => ({ ...prev, profile: { ...prev.profile, sex: option } }));
                    setSexPickerOpen(false);
                  }}
                >
                  {option}
                  {selected && <Check aria-hidden="true" />}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}

function LeaderRow({
  rank,
  row,
}: {
  rank: number;
  row: { userId: string | null; photo: string | null; name: string; minutes: number; avatar: string; you: boolean };
}) {
  const onlineUsers = useOnlineUsers();
  const isOnline = row.you || (row.userId != null && onlineUsers.has(row.userId));
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl px-3 py-2 shadow-soft transition-all animate-fade-up",
        row.you ? "bg-primary/8 ring-1 ring-primary/40" : "bg-card",
      )}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <div className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
        {medal ?? rank}
      </div>
      <div
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm shadow-inner"
        style={{ background: row.avatar }}
      >
        {row.photo ? (
          <img src={row.photo} alt={`${row.name}'s profile photo`} className="h-8 w-8 rounded-full object-cover" loading="lazy" />
        ) : (
          <span className="font-display text-[11px] font-semibold text-white">
            {row.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
        )}
        {isOnline && (
          <span aria-label="Online" className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-online ring-2 ring-card" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {row.name}
          {row.you && (
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </p>
      </div>
      <div className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
        <Clock className="h-3 w-3 text-primary" />
        {formatHours(row.minutes)}
      </div>
    </div>
  );
}

const AVATARS = [
  "linear-gradient(135deg,#2E7D32,#66BB6A)",
  "linear-gradient(135deg,#1565C0,#42A5F5)",
  "linear-gradient(135deg,#AD1457,#EC407A)",
  "linear-gradient(135deg,#4527A0,#7E57C2)",
  "linear-gradient(135deg,#EF6C00,#FFB74D)",
  "linear-gradient(135deg,#00695C,#4DB6AC)",
  "linear-gradient(135deg,#6A1B9A,#BA68C8)",
  "linear-gradient(135deg,#37474F,#78909C)",
  "linear-gradient(135deg,#C62828,#EF5350)",
  "linear-gradient(135deg,#2E7D32,#81C784)",
];

/** Ranked by total study hours, live from the cloud. */
function buildLeaderboard(
  cloudLeaders: { userId: string; name: string; minutes: number; photo: string | null }[],
  userName: string,
  userMinutes: number,
  userPhoto: string | null,
  userId?: string,
) {
  const rows: { userId: string | null; photo: string | null; name: string; minutes: number; avatar: string; you: boolean }[] = cloudLeaders.map((r, i) => ({
    userId: r.userId,
    photo: r.photo,
    name: r.name,
    minutes: r.minutes,
    avatar: AVATARS[i % AVATARS.length],
    you: r.userId === userId,
  }));
  if (!rows.some((r) => r.you)) {
    rows.push({
      userId: userId ?? null,
      photo: userPhoto,
      name: userName,
      minutes: userMinutes,
      avatar: "linear-gradient(135deg,#2E7D32,#4CAF50)",
      you: true,
    });
  }
  rows.sort((a, b) => b.minutes - a.minutes);
  return rows.slice(0, 10);
}

function Field({
  label,
  value,
  editing,
  draft,
  onChange,
  divider,
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onChange: (v: string) => void;
  divider?: boolean;
}) {
  return (
    <div className={cn("min-w-0 px-3", divider && "border-l border-hairline")}>
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-hairline bg-background px-2 py-1 text-sm outline-none focus:border-primary"
        />
      ) : (
        <p className="mt-0.5 truncate text-sm font-medium" title={value}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}
