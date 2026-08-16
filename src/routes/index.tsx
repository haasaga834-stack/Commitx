import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, Flame } from "lucide-react";
import { Hourglass } from "@/components/Hourglass";
import { MobileShell } from "@/components/BottomNav";
import { FoodCoins } from "@/components/FoodCoins";
import { DailyGoalProgress } from "@/components/DailyGoalProgress";
import { NextUpCard } from "@/components/NextUpCard";
import { TodaysPlan } from "@/components/TodaysPlan";
import { StudyInsightsCard } from "@/components/StudyInsightsCard";

import { useAppState, stats } from "@/lib/commitx-store";
import { useCommunityFoodCoins } from "@/lib/community";

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
  const navigate = useNavigate();
  const { state, hydrated } = useAppState();
  const s = stats(state.sessions);
  const community = useCommunityFoodCoins();
  const firstName = state.profile.name.split(" ")[0];
  const initials = state.profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  const focusToday =
    s.todayMinutes >= 60
      ? `${Math.floor(s.todayMinutes / 60)}h ${s.todayMinutes % 60}m`
      : `${s.todayMinutes}m`;

  return (
    <MobileShell>
      <div className="px-6 pt-14">
        {/* Greeting + profile */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 animate-fade-up">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting()},</p>
            <h1 className="mt-1 truncate text-3xl font-semibold text-foreground">
              {hydrated ? firstName : "\u00A0"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/settings"
              aria-label="Notifications and settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-card text-foreground shadow-soft"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-base font-semibold text-primary-foreground shadow-soft"
            >
              {hydrated && state.profile.photo ? (
                <img
                  src={state.profile.photo}
                  alt="Your profile photo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{hydrated ? initials : ""}</span>
              )}
            </Link>
          </div>
        </div>

        {/* Streak · focus today · Food Coins */}
        <div
          className="mt-5 flex gap-2 animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <StatChip
            label="Day streak"
            value={`${s.streak}`}
            icon={<Flame className="h-3 w-3" />}
          />
          <StatChip label="Focus today" value={focusToday} />
          <StatChip label="Food Coins" value={hydrated ? `${s.foodCoins}` : "—"} />
        </div>

        {/* Primary focus */}
        <div className="mt-6 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <NextUpCard onStart={() => navigate({ to: "/commit" })} />
        </div>

        {/* Today's plan */}
        <div className="mt-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <TodaysPlan />
        </div>

        {/* Study insights */}
        <div className="mt-4 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <StudyInsightsCard />
        </div>

        {/* Current commitment */}
        <div
          className="mt-8 flex flex-col items-center animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          <Hourglass size={220} state="idle" />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            One promise at a time.
          </p>
        </div>

        <div className="mt-6 animate-fade-up" style={{ animationDelay: "340ms" }}>
          <DailyGoalProgress todayMinutes={s.todayMinutes} hydrated={hydrated} />
        </div>

        <div className="mt-4 animate-fade-up" style={{ animationDelay: "380ms" }}>
          <Link
            to="/commit"
            className="block w-full rounded-full bg-primary px-8 py-5 text-center text-base font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
          >
            Commit Now
          </Link>
        </div>

        <div className="mt-8 mb-4 animate-fade-up" style={{ animationDelay: "420ms" }}>
          <FoodCoins
            userCoins={s.foodCoins}
            milestone={1000}
            communityCoins={community.coins}
            hydrated={hydrated && community.loaded}
          />
        </div>
      </div>
    </MobileShell>
  );
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-card px-3 py-3 shadow-soft">
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 truncate text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
