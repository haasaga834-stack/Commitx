import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, stats, setState, formatCoins } from "@/lib/commitx-store";
import { useState, useEffect, useMemo, useRef } from "react";
import { Pencil, Check, Trophy, Clock, Camera, Settings as SettingsIcon } from "lucide-react";
import { fileToProfilePhoto } from "@/lib/profile-photo";
import { refreshFromCloud } from "@/lib/cloud-sync";

import { formatHours } from "@/lib/analytics-data";

import { useLeaderboard } from "@/lib/community";



export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "CommitX — Profile" },
      { name: "description", content: "Your discipline, in numbers." },
      { property: "og:title", content: "CommitX — Profile" },
      { property: "og:description", content: "Your discipline, in numbers." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { state, hydrated } = useAppState();
  const s = stats(state.sessions);
  const [editing, setEditing] = useState(false);
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
    () => buildLeaderboard(cloudLeaders, state.profile.name, s.totalMinutes),
    [cloudLeaders, state.profile.name, s.totalMinutes],
  );

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Profile
          </p>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
            <button
              onClick={() => (editing ? save() : setEditing(true))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
              aria-label={editing ? "Save" : "Edit"}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
        </div>


        <div className="mt-8 flex flex-col items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-3xl font-semibold text-primary-foreground shadow-lift">
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
              className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-lift"
              aria-label="Change profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>

          {photo && (
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, profile: { ...prev.profile, photo: "" } }))}
              className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Remove photo
            </button>
          )}

          {photoError && (
            <p className="mt-2 text-xs text-destructive">{photoError}</p>
          )}

          {editing ? (
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-5 rounded-2xl border border-hairline bg-card px-4 py-2 text-center text-lg font-semibold outline-none focus:border-primary"
            />
          ) : (
            <h1 className="mt-5 font-display text-2xl font-semibold">
              {state.profile.name}
            </h1>
          )}
        </div>


        <div className="mt-8 rounded-3xl bg-card p-5 shadow-soft">
          <Field
            label="Age"
            value={state.profile.age}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, age: v })}
            draft={draft.age}
          />
          <Divider />
          <Field
            label="Sex"
            value={state.profile.sex}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, sex: v })}
            draft={draft.sex}
          />
          <Divider />
          <Field
            label="Education"
            value={state.profile.education}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, education: v })}
            draft={draft.education}
          />
        </div>

        <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Dashboard
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cx Coins" value={hydrated ? formatCoins(state.coins) : "—"} />
          <Stat label="Coins earned" value={formatCoins(s.coinsEarned)} />
          <Stat label="Current streak" value={`${s.streak}d`} />
          <Stat label="Longest streak" value={`${s.longest}d`} />
          <Stat label="Focus hours" value={totalHours} />
          <Stat label="Success rate" value={`${s.successRate}%`} />
          <Stat label="Completed" value={String(s.completed)} />
          <Stat label="Failed" value={String(s.failed)} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Top 10 · Study Hours
          </p>
          <Trophy className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-4 space-y-2">
          {leaderboard.map((row, i) => (
            <LeaderRow key={row.name + i} rank={i + 1} row={row} />
          ))}
        </div>

        <div className="h-4" />


      </div>
    </MobileShell>
  );
}

function LeaderRow({
  rank,
  row,
}: {
  rank: number;
  row: { name: string; minutes: number; avatar: string; you: boolean };
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition-all animate-fade-up ${
        row.you ? "bg-primary/8 ring-1 ring-primary/40" : "bg-card"
      }`}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <div className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {medal ?? rank}
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg shadow-inner"
        style={{ background: row.avatar }}
      >
        <span className="font-display text-sm font-semibold text-white">
          {row.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {row.name}
          {row.you && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </p>
      </div>
      <div className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
        <Clock className="h-3.5 w-3.5 text-primary" />
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
  cloudLeaders: { userId: string; name: string; minutes: number }[],
  userName: string,
  userMinutes: number,
) {
  const rows = cloudLeaders.map((r, i) => ({
    name: r.name,
    minutes: r.minutes,
    avatar: AVATARS[i % AVATARS.length],
    you: r.name === userName && r.minutes === userMinutes,
  }));
  if (!rows.some((r) => r.you)) {
    rows.push({
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
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[60%] rounded-lg border border-hairline bg-background px-3 py-1 text-right text-sm outline-none focus:border-primary"
        />
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-hairline" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}


