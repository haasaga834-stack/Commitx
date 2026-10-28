import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, coinLabel } from "@/lib/commitx-store";
import { Hourglass } from "@/components/Hourglass";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "CommitX — History" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Every commitment you've made." },
      { property: "og:title", content: "CommitX — History" },
      { property: "og:description", content: "Every commitment you've made." },
    ],
  }),
  component: History,
});

function fmtDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDur(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function History() {
  const { state, hydrated } = useAppState();

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          History
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Kept promises</h1>

        {hydrated && state.sessions.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <Hourglass size={140} state="idle" />
            <p className="mt-8 text-sm text-muted-foreground">
              Your commitments will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {state.sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-3xl bg-card p-5 shadow-soft"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold">{s.goal}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.date)} · {fmtDur(s.durationMinutes)}
                    </p>
                  </div>
                  <span
                    className={
                      s.status === "completed"
                        ? "rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-primary"
                        : "rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
                    }
                  >
                    {s.status === "completed" ? "Completed" : "Failed"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Commitment value</span>
                  <span className="font-medium tabular-nums">{coinLabel(s.value)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {s.status === "completed" ? "Cx Coins earned" : "Cx Coins lost"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {s.status === "completed"
                      ? `+${coinLabel(s.coinsEarned ?? 0)}`
                      : `−${coinLabel(s.coinsSpent ?? 0)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
