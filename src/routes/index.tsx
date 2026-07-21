import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { MobileShell } from "@/components/BottomNav";
import { useAppState, stats } from "@/lib/commitx-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CommitX — Home" },
      {
        name: "description",
        content:
          "Start a focused commitment. One promise at a time, kept beautifully.",
      },
      { property: "og:title", content: "CommitX — Home" },
      {
        property: "og:description",
        content: "Start a focused commitment. One promise at a time.",
      },
    ],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const { state, hydrated } = useAppState();
  const s = stats(state.sessions);
  const firstName = state.profile.name.split(" ")[0];

  const focusToday =
    s.todayMinutes >= 60
      ? `${Math.floor(s.todayMinutes / 60)}h ${s.todayMinutes % 60}m`
      : `${s.todayMinutes}m`;

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        <div className="animate-fade-up">
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">
            {hydrated ? firstName : "\u00A0"}
          </h1>
        </div>

        <div
          className="mt-6 flex gap-3 animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <StatChip label="Current streak" value={`${s.streak} ${s.streak === 1 ? "day" : "days"}`} />
          <StatChip label="Focus today" value={focusToday} />
        </div>

        <div
          className="mt-10 flex flex-col items-center animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          <Hourglass size={240} state="idle" />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            One promise at a time.
          </p>
        </div>

        <div
          className="mt-10 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            to="/commit"
            className="block w-full rounded-full bg-primary px-8 py-5 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
          >
            Commit Now
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-card px-4 py-3 shadow-soft">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
