import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { Check } from "lucide-react";
import { z } from "zod";
import { useAppState, stats } from "@/lib/commitx-store";

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().default(0),
  value: z.coerce.number().default(0),
});

export const Route = createFileRoute("/success")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "CommitX — Commitment complete" },
      { name: "description", content: "You kept your promise." },
      { property: "og:title", content: "CommitX — Commitment complete" },
      { property: "og:description", content: "You kept your promise." },
    ],
  }),
  component: Success,
});

function Success() {
  const { goal, duration, value } = Route.useSearch();
  const { state } = useAppState();
  const s = stats(state.sessions);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Hourglass size={220} state="success" />
      <div className="mt-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lift animate-fade-up">
        <Check className="h-7 w-7" strokeWidth={2.6} />
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold animate-fade-up">
        Commitment complete
      </h1>
      <p
        className="mt-1 text-sm text-muted-foreground animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {goal}
      </p>

      <div
        className="mt-8 w-full max-w-xs space-y-3 animate-fade-up"
        style={{ animationDelay: "140ms" }}
      >
        <Row label="Duration" value={`${duration} min`} />
        <Row label="Demo value returned" value={`$${value}`} />
        <Row label="Streak" value={`${s.streak} ${s.streak === 1 ? "day" : "days"} (+1)`} />
      </div>

      <Link
        to="/"
        className="mt-10 inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-base font-medium text-primary-foreground shadow-soft"
      >
        Done
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-soft">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
