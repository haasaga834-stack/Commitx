import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, stats, setState, formatINR } from "@/lib/commitx-store";
import { useState, useEffect, useMemo } from "react";
import { Pencil, Check, Trophy, Flame } from "lucide-react";

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

  useEffect(() => {
    setDraft(state.profile);
  }, [state.profile]);

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

  const leaderboard = useMemo(() => buildLeaderboard(state.profile.name, s.streak), [state.profile.name, s.streak]);

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Profile
          </p>
          <button
            onClick={() => (editing ? save() : setEditing(true))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
            aria-label={editing ? "Save" : "Edit"}
          >
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary font-display text-3xl font-semibold text-primary-foreground shadow-lift">
            {hydrated ? initials : ""}
          </div>
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
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Current streak" value={`${s.streak}d`} />
          <Stat label="Longest streak" value={`${s.longest}d`} />
          <Stat label="Focus hours" value={totalHours} />
          <Stat label="Success rate" value={`${s.successRate}%`} />
          <Stat label="Completed" value={String(s.completed)} />
          <Stat label="Failed" value={String(s.failed)} />
          <Stat label="Food Coins" value={`🪙 ${s.foodCoins.toLocaleString("en-IN")}`} />
          <Stat label="Commitments" value={String(s.completed)} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Top 10 · Streak Leaderboard
          </p>
          <Trophy className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-4 space-y-2 pb-4">
          {leaderboard.map((row, i) => (
            <LeaderRow key={row.name + i} rank={i + 1} row={row} />
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

function LeaderRow({
  rank,
  row,
}: {
  rank: number;
  row: { name: string; streak: number; avatar: string; you: boolean };
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition-all animate-fade-up ${
        row.you ? "bg-primary/8 ring-1 ring-primary/40" : "bg-card"
      }`}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <div className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {medal ?? rank}
      </div>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-inner"
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
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {row.name}
          {row.you && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </p>
      </div>
      <div className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
        <Flame className="h-3.5 w-3.5 text-primary" />
        {row.streak}d
      </div>
    </div>
  );
}

const MOCK_LEADERS = [
  { name: "Ananya Rao", streak: 42, avatar: "linear-gradient(135deg,#2E7D32,#66BB6A)" },
  { name: "Vikram Iyer", streak: 38, avatar: "linear-gradient(135deg,#1565C0,#42A5F5)" },
  { name: "Priya Shah", streak: 31, avatar: "linear-gradient(135deg,#AD1457,#EC407A)" },
  { name: "Rohan Kapoor", streak: 27, avatar: "linear-gradient(135deg,#4527A0,#7E57C2)" },
  { name: "Meera Nair", streak: 22, avatar: "linear-gradient(135deg,#EF6C00,#FFB74D)" },
  { name: "Kabir Sen", streak: 18, avatar: "linear-gradient(135deg,#00695C,#4DB6AC)" },
  { name: "Ishita Verma", streak: 15, avatar: "linear-gradient(135deg,#6A1B9A,#BA68C8)" },
  { name: "Aditya Joshi", streak: 12, avatar: "linear-gradient(135deg,#37474F,#78909C)" },
  { name: "Neha Gupta", streak: 9, avatar: "linear-gradient(135deg,#C62828,#EF5350)" },
  { name: "Siddharth Rao", streak: 6, avatar: "linear-gradient(135deg,#2E7D32,#81C784)" },
];

function buildLeaderboard(userName: string, userStreak: number) {
  const you = {
    name: userName,
    streak: userStreak,
    avatar: "linear-gradient(135deg,#2E7D32,#4CAF50)",
    you: true,
  };
  const combined = [
    ...MOCK_LEADERS.map((m) => ({ ...m, you: false })),
    you,
  ];
  combined.sort((a, b) => b.streak - a.streak);
  return combined.slice(0, 10);
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

// Silence unused-import lint for formatINR (kept for future extension).
void formatINR;
