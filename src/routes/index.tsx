import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { MobileShell } from "@/components/BottomNav";
import { FoodCoins } from "@/components/FoodCoins";
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
        content: "Start a focused commitment. One promise at a time, kept beautifully.",
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
      <div className="px-6 pt-14 md:px-10 md:pt-20">
        <div className="animate-fade-up">
          <p className="text-sm text-muted-foreground md:text-base">{greeting()},</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground md:text-4xl lg:text-5xl">
            {hydrated ? firstName : "\u00A0"}
          </h1>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div>
            <div
              className="mt-6 flex gap-3 animate-fade-up md:gap-4"
              style={{ animationDelay: "80ms" }}
            >
              <StatChip label="Current streak" value={`${s.streak} ${s.streak === 1 ? "day" : "days"}`} />
              <StatChip label="Focus today" value={focusToday} />
            </div>

            <div
              className="mt-10 flex flex-col items-center animate-fade-up"
              style={{ animationDelay: "160ms" }}
            >
              <Hourglass size={240} state="idle" className="md:!max-w-[300px] lg:!max-w-[340px]" />
              <p className="mt-6 text-center text-sm text-muted-foreground md:text-base">
                One promise at a time.
              </p>
            </div>
          </div>

          <div className="lg:mt-6">
            <div
              className="mt-10 animate-fade-up lg:mt-0"
              style={{ animationDelay: "220ms" }}
            >
              <FoodCoins
                userCoins={s.foodCoins}
                milestone={1000}
                communityCoins={1284650 + s.foodCoins}
                hydrated={hydrated}
              />
            </div>

            <div
              className="mt-6 mb-4 animate-fade-up"
              style={{ animationDelay: "320ms" }}
            >
              <Link
                to="/commit"
                className="mx-auto block w-full max-w-md rounded-full bg-primary px-8 py-5 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] md:py-6 md:text-lg"
              >
                Commit Now
              </Link>
            </div>
          </div>
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
