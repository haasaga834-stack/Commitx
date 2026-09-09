import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import heroImage from "@/assets/landing-hero.jpg";

const INDUS_APPSTORE_URL = "https://indusapp.store/nnbmdn4h";

type Mode = "standard" | "verified";

const MODE_COPY: Record<
  Mode,
  { label: string; title: string; body: string }
> = {
  standard: {
    label: "Standard",
    title: "A flexible space to focus.",
    body: "Set your goal, choose your time, and focus without unnecessary pressure.",
  },
  verified: {
    label: "Verified",
    title: "When you really need to get it done.",
    body: "A stricter focus experience designed to keep you accountable throughout your commitment.",
  },
};

/** Reveals a section once it scrolls into view — calm, one-time, no jitter. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    // Anything already on screen shows straight away.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${shown ? "animate-landing-reveal" : "opacity-0"}`}
      style={shown ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  variant = "dark",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "dark" | "light";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-4 text-sm font-medium transition-all duration-300 sm:w-auto ${
        variant === "dark"
          ? "bg-ink text-paper hover:opacity-90"
          : "border border-ink-line bg-paper text-ink hover:border-ink/30"
      }`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}

function ModeModal({
  mode,
  onClose,
  onContinue,
}: {
  mode: Mode;
  onClose: () => void;
  onContinue: () => void;
}) {
  const copy = MODE_COPY[mode];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.label} session`}
      onClick={onClose}
    >
      <div
        className="animate-landing-modal w-full max-w-lg rounded-t-[28px] bg-paper p-7 pb-10 shadow-lift sm:rounded-[28px] sm:p-10 sm:pb-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
            {copy.label}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-6 text-[26px] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[32px]">
          {copy.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
          {copy.body}
        </p>

        <div className="mt-8">
          <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        </div>

        <div className="mt-5 text-center">
          <Link
            to="/auth"
            className="text-xs text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <p className="mt-4 text-[11px] text-ink-soft/80">
            No account required to start.
          </p>
        </div>
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Standard", href: "#modes" },
  { label: "Verified", href: "#modes" },
];

export function Landing() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<Mode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function start(mode: Mode) {
    setModal(null);
    navigate({ to: "/commit", search: { mode } });
  }

  return (
    <div className="landing-root min-h-dvh scroll-smooth">
      {/* NAV */}
      <header
        className={`fixed inset-x-0 top-0 z-50 px-3 transition-all duration-500 sm:px-5 ${
          scrolled ? "pt-2" : "pt-3 sm:pt-4"
        }`}
      >
        <nav
          className={`mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-full px-5 transition-all duration-500 sm:px-7 ${
            scrolled
              ? "border border-ink-line/70 bg-paper/80 py-2.5 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] backdrop-blur-xl"
              : "border border-transparent py-4"
          }`}
        >
          <a href="#top" className="min-w-0 text-lg font-semibold tracking-[-0.02em]">
            CommitX
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/about"
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              About
            </Link>
            <Link
              to="/auth"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-full p-2 text-ink md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </header>

      {/* MOBILE DRAWER */}
      {menuOpen ? (
        <div className="fixed inset-0 z-[60] bg-paper px-6 py-5 md:hidden">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-[-0.02em]">CommitX</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="rounded-full p-2 text-ink-soft"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-12 flex flex-col gap-7">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-2xl font-medium tracking-[-0.02em]"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/about"
              onClick={() => setMenuOpen(false)}
              className="text-2xl font-medium tracking-[-0.02em]"
            >
              About
            </Link>
            <Link
              to="/auth"
              onClick={() => setMenuOpen(false)}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-6 py-4 text-sm font-medium text-paper"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : null}

      {/* HERO */}
      <section
        id="top"
        className="relative overflow-hidden px-6 pb-16 pt-28 sm:pb-24 sm:pt-36"
        onMouseMove={(e) => {
          if (typeof window === "undefined" || window.innerWidth < 900) return;
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({
            x: (e.clientX - r.left) / r.width - 0.5,
            y: (e.clientY - r.top) / r.height - 0.5,
          });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden
          width={1920}
          height={1152}
          className="pointer-events-none absolute inset-x-0 top-0 h-[52vh] w-full object-cover opacity-[0.16]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[52vh]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, color-mix(in oklab, var(--paper) 60%, transparent) 50%, var(--paper) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10">
            <div className="animate-landing-reveal text-center lg:text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-ink-soft">
                Commit. Complete. Get It Back.
              </p>
              <h1 className="mt-6 text-[36px] font-medium leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[70px]">
                For the things you
                <br />
                said you'd do.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-ink-soft lg:mx-0 sm:text-base">
                Turn “I should” into “I did.” Start with a commitment. Stay focused.
                Follow through.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <PrimaryButton onClick={() => setModal("standard")}>
                  Start a Standard Session
                </PrimaryButton>
                <PrimaryButton variant="light" onClick={() => setModal("verified")}>
                  Start a Verified Session
                </PrimaryButton>
              </div>
              <p className="mt-5 text-[11px] text-ink-soft/80">
                No account required to start.
              </p>
            </div>

            {/* INTERACTIVE HOURGLASS */}
            <div className="relative mx-auto flex w-full max-w-md items-center justify-center py-6">
              <div
                className="relative text-ink transition-transform duration-500 ease-out"
                style={{
                  transform: `translate3d(${tilt.x * 16}px, ${tilt.y * 14}px, 0)`,
                }}
              >
                <LandingHourglass size={300} className="sm:scale-105" />
              </div>

              {[
                { text: "50 min • Anatomy", cls: "left-0 top-4 sm:-left-2", d: "0s", f: 0.5 },
                { text: "🔥 12 day streak", cls: "right-0 top-1/3 sm:-right-3", d: "1.2s", f: -0.7 },
                { text: "+25 Cx Coins", cls: "bottom-6 left-4 sm:left-2", d: "2.1s", f: 0.9 },
              ].map((c) => (
                <div
                  key={c.text}
                  className="animate-gentle-float pointer-events-none absolute rounded-2xl border border-ink-line/80 bg-paper/80 px-3.5 py-2 text-[11px] font-medium shadow-[0_16px_40px_-24px_rgb(0_0_0/0.45)] backdrop-blur-md sm:text-xs"
                  style={{
                    animationDelay: c.d,
                    transform: `translate3d(${tilt.x * 26 * c.f}px, ${tilt.y * 20 * c.f}px, 0)`,
                    transition: "transform 600ms ease-out",
                  }}
                  {...{ className: undefined as never }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTRODUCTION */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-3xl text-[26px] font-medium leading-[1.18] tracking-[-0.03em] sm:text-[42px]">
              Built for students who want to stop procrastinating and start doing.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-10 sm:mt-20 sm:grid-cols-3 sm:gap-12">
            {[
              ["Focus", "Turn your goals into dedicated sessions."],
              ["Accountability", "Verified sessions help you stay on track."],
              ["Consistency", "Build momentum through completed commitments."],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="border-t border-ink-line pt-5">
                  <h3 className="text-base font-medium">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* STANDARD VS VERIFIED */}
      <section id="modes" className="bg-paper-soft px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <Reveal>
              <div className="flex h-full flex-col rounded-[28px] border border-ink-line bg-paper p-8 transition-all duration-300 hover:-translate-y-1 sm:p-10">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
                  Standard
                </p>
                <h3 className="mt-6 text-2xl font-medium leading-tight tracking-[-0.02em] sm:text-[28px]">
                  Flexible focus for everyday studying.
                </h3>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-soft">
                  Set a goal, choose your time, and focus without unnecessary pressure.
                </p>
                <button
                  type="button"
                  onClick={() => setModal("standard")}
                  className="group mt-8 inline-flex items-center gap-2 self-start text-sm font-medium"
                >
                  Start Standard
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="flex h-full flex-col rounded-[28px] border border-ink/15 bg-ink p-8 text-paper transition-all duration-300 hover:-translate-y-1 sm:p-10">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-paper/60">
                  Verified
                </p>
                <h3 className="mt-6 text-2xl font-medium leading-tight tracking-[-0.02em] sm:text-[28px]">
                  Strict accountability when you absolutely need to get it done.
                </h3>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-paper/70">
                  For sessions where staying focused matters more than ever.
                </p>
                <button
                  type="button"
                  onClick={() => setModal("verified")}
                  className="group mt-8 inline-flex items-center gap-2 self-start text-sm font-medium"
                >
                  Start Verified
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 sm:grid-cols-3 sm:gap-10">
            {[
              ["01", "Choose", "Choose Standard or Verified."],
              ["02", "Commit", "Set your goal and dedicate your time."],
              ["03", "Complete", "Stay focused and finish what you started."],
            ].map(([n, title, body], i) => (
              <Reveal key={n} delay={i * 90}>
                <p className="text-xs tracking-[0.2em] text-ink-soft/70">{n}</p>
                <h3 className="mt-5 text-2xl font-medium tracking-[-0.02em] sm:text-[30px]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* EMOTIONAL */}
      <section className="px-6 py-28 text-center sm:py-40">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-[32px] font-medium leading-[1.1] tracking-[-0.035em] sm:text-[60px]">
            Turn “I should” into “I did.”
          </h2>
          <p className="mt-7 text-sm text-ink-soft sm:text-base">
            Every completed commitment is a step forward.
          </p>
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section className="bg-paper-soft px-6 py-20 text-center sm:py-28">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-[28px] font-medium leading-[1.14] tracking-[-0.03em] sm:text-[44px]">
            What will you commit to today?
          </h2>
          <p className="mt-5 text-sm text-ink-soft sm:text-base">
            Start with one focused session.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton onClick={() => setModal("standard")}>
              Start a Standard Session
            </PrimaryButton>
            <PrimaryButton variant="light" onClick={() => setModal("verified")}>
              Start a Verified Session
            </PrimaryButton>
          </div>
          <p className="mt-5 text-[11px] text-ink-soft/80">
            No account required to start.
          </p>
        </Reveal>
      </section>

      {/* CONTINUE ON APP */}
      <section className="px-6 py-16 sm:py-20">
        <Reveal>
          <div className="mx-auto grid max-w-4xl gap-6 rounded-[28px] border border-ink-line px-8 py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-10">
            <div className="min-w-0">
              <h2 className="text-xl font-medium tracking-[-0.02em]">
                Prefer the CommitX app?
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Continue your journey on the CommitX app.
              </p>
            </div>
            <a
              href={INDUS_APPSTORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-ink-line px-6 py-3.5 text-sm font-medium transition-colors hover:border-ink/30"
            >
              Continue on app
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink-line px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-base font-semibold tracking-[-0.02em]">CommitX</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-soft">
            <a href="#how-it-works" className="hover:text-ink">
              How it works
            </a>
            <a href="#modes" className="hover:text-ink">
              Standard
            </a>
            <a href="#modes" className="hover:text-ink">
              Verified
            </a>
            <Link to="/about" className="hover:text-ink">
              About
            </Link>
            <Link to="/auth" className="hover:text-ink">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-ink-soft/80">
            © {new Date().getFullYear()} CommitX
          </p>
        </div>
      </footer>

      {modal ? (
        <ModeModal
          mode={modal}
          onClose={() => setModal(null)}
          onContinue={() => start(modal)}
        />
      ) : null}
    </div>
  );
}
