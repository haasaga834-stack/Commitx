import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "@/components/Hourglass";
import { z } from "zod";

const search = z.object({
  goal: z.string().default("Focus"),
  duration: z.coerce.number().default(0),
  value: z.coerce.number().default(0),
  reason: z.string().optional(),
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

function reasonCopy(reason?: string) {
  switch (reason) {
    case "background":
      return "You left the app while using Verified Mode.";
    case "killed":
      return "The app was closed during a Verified session.";
    case "quit":
      return "You ended the session before it completed.";
    default:
      return "The session was not completed.";
  }
}

function Failed() {
  const { goal, value, reason } = Route.useSearch();
  const isVerifiedBreak = reason === "background" || reason === "killed";
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Hourglass size={200} state="failed" />
      <div className="mt-10 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          ❌
        </span>
        <h1 className="font-display text-3xl font-semibold animate-fade-up">
          Commitment Failed
        </h1>
      </div>
      <p
        className="mt-1 text-sm text-muted-foreground animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {goal}
      </p>

      {isVerifiedBreak && (
        <div
          className="mt-6 max-w-xs rounded-3xl bg-card px-5 py-4 text-center shadow-soft animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Reason
          </p>
          <p className="mt-2 text-sm text-foreground">{reasonCopy(reason)}</p>
        </div>
      )}

      <p
        className="mt-5 rounded-2xl bg-foreground/5 px-5 py-3 text-sm text-foreground animate-fade-up"
        style={{ animationDelay: "180ms" }}
      >
        ${value} demo value deducted
      </p>

      <Link
        to="/"
        className="mt-10 inline-block w-full max-w-xs rounded-full bg-foreground px-8 py-4 text-center text-base font-medium text-background shadow-soft"
      >
        Return Home
      </Link>
    </div>
  );
}
