import { Link } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";

/**
 * Home-screen entry point into the Group Study flow. Uses the same tokens,
 * radii and shadows as the rest of the Home cards so it reads as native.
 */
export function GroupStudyCard({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-hairline bg-card shadow-soft ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
          <Users className="h-4.5 w-4.5" />
        </span>
        <div className="mt-2 min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground">
            Group Study
          </h2>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Up to 20 people · one shared timer
          </p>
        </div>
      </div>

      <div className="mt-3.5 rounded-2xl bg-background px-3.5 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">Lock in with your people. 🎯</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a time, commit together, and see who makes it to the finish.
        </p>
      </div>


      <Link
        to="/group"
        className="mt-3.5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
      >
        Challenge Your Friends
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
