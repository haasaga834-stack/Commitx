import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { z } from "zod";

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().default(0),
  value: z.coerce.number().default(0),
});

export const Route = createFileRoute("/failed")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "CommitX — Commitment failed" },
      { name: "description", content: "The promise wasn't kept this time." },
      { property: "og:title", content: "CommitX — Commitment failed" },
      { property: "og:description", content: "The promise wasn't kept this time." },
    ],
  }),
  component: Failed,
});

function Failed() {
  const { goal, value } = Route.useSearch();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Hourglass size={220} state="failed" />
      <h1 className="mt-10 font-display text-3xl font-semibold animate-fade-up">
        Commitment failed
      </h1>
      <p
        className="mt-1 text-sm text-muted-foreground animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {goal}
      </p>
      <p
        className="mt-6 rounded-2xl bg-card px-5 py-3 text-sm text-foreground shadow-soft animate-fade-up"
        style={{ animationDelay: "140ms" }}
      >
        ${value} demo value deducted
      </p>
      <Link
        to="/"
        className="mt-10 inline-block w-full max-w-xs rounded-full bg-foreground px-8 py-4 text-center text-base font-medium text-background shadow-soft"
      >
        Return home
      </Link>
    </div>
  );
}
