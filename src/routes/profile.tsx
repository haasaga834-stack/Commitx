import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, stats, setState } from "@/lib/commitx-store";
import { useState, useEffect } from "react";
import { Pencil, Check } from "lucide-react";

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
          Statistics
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Current streak" value={`${s.streak}d`} />
          <Stat label="Longest streak" value={`${s.longest}d`} />
          <Stat label="Completed" value={String(s.completed)} />
          <Stat label="Failed" value={String(s.failed)} />
          <Stat label="Focus hours" value={totalHours} />
          <Stat label="Success rate" value={`${s.successRate}%`} />
        </div>
      </div>
    </MobileShell>
  );
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
