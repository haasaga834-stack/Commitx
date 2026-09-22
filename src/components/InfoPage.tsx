import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MobileShell } from "@/components/BottomNav";
import { PublicFooter } from "@/components/PublicFooter";

export interface InfoFeature {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface InfoPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: { label: string; to: string };
  primaryNote?: string;
  featuresHeading: string;
  features: InfoFeature[];
  stepsHeading?: string;
  steps?: string[];
  notesHeading?: string;
  notes?: string[];
  closing: { heading: string; body: string; label: string; to: string };
  related?: { label: string; to: string }[];
}

export function InfoPage({
  eyebrow,
  title,
  intro,
  primaryCta,
  primaryNote,
  featuresHeading,
  features,
  stepsHeading,
  steps,
  notesHeading,
  notes,
  closing,
  related,
}: InfoPageProps) {
  return (
    <MobileShell>
      <div className="mx-auto w-full max-w-3xl px-6 pt-14 pb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {intro}
        </p>

        <Link
          to={primaryCta.to}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-soft transition-transform active:scale-[0.98] sm:w-auto"
        >
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {primaryNote ? (
          <p className="mt-3 text-xs text-muted-foreground">{primaryNote}</p>
        ) : null}

        <h2 className="mt-10 font-display text-xl font-semibold">
          {featuresHeading}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-hairline bg-card p-5 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-medium">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {steps && steps.length > 0 ? (
          <>
            <h2 className="mt-10 font-display text-xl font-semibold">
              {stepsHeading}
            </h2>
            <ol className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {notes && notes.length > 0 ? (
          <>
            <h2 className="mt-10 font-display text-xl font-semibold">
              {notesHeading}
            </h2>
            <div className="mt-4 space-y-2">
              {notes.map((line) => (
                <div
                  key={line}
                  className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-8 rounded-3xl border border-hairline bg-card p-6 text-center shadow-soft">
          <h2 className="font-display text-lg font-semibold">{closing.heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{closing.body}</p>
          <Link
            to={closing.to}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-[20px] bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
          >
            {closing.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {related && related.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              {related.map((r) => (
                <Link
                  key={r.to}
                  to={r.to}
                  className="text-primary hover:underline"
                >
                  {r.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <PublicFooter />
    </MobileShell>
  );
}
