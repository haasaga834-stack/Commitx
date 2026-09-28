import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import heroImage from "@/assets/landing-hero.jpg";
import { LandingHourglass } from "@/components/LandingHourglass";
import { FocusGarden } from "@/components/FocusGarden";
import { GuestSetup } from "@/components/GuestSetup";
import { FocusClassSetup } from "@/components/FocusClassSetup";
import { GroupSetup } from "@/components/GroupSetup";
import { LandingReviews } from "@/components/LandingReviews";
import { useFocusClassCount } from "@/lib/focus-class";
import { useAuth } from "@/lib/use-auth";
import { useAppState, formatCoins } from "@/lib/commitx-store";

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

/** Very gentle scroll-linked drift for the hero backdrop. */
function useScrollDrift(max = 60) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setOffset(Math.min(max, window.scrollY * 0.16));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [max]);

  return offset;
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
      className={`group inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-4 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:w-auto ${
        variant === "dark"
          ? "bg-ink text-paper hover:shadow-[0_18px_36px_-20px_rgb(0_0_0/0.6)] hover:opacity-95"
          : "border border-ink-line bg-paper/80 text-ink backdrop-blur hover:border-ink/30 hover:shadow-[0_18px_36px_-24px_rgb(0_0_0/0.35)]"
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
  const { user } = useAuth();
  const signedIn = Boolean(user);

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
          {signedIn ? (
            <p className="text-[11px] text-ink-soft/80">
              Your session is saved to your CommitX account.
            </p>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-xs text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <p className="mt-4 text-[11px] text-ink-soft/80">
                No account required to start.
              </p>
            </>
          )}
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

const FAQ_ITEMS = [
  [
    "What is CommitX?",
    "CommitX is a focus and accountability app that helps you turn study or work intentions into timed commitments.",
  ],
  [
    "How does a focus session work?",
    "Choose a goal, duration, theme, and mode, then start the timer and focus until the session ends.",
  ],
  [
    "What is Standard?",
    "Standard is the flexible mode for everyday focus sessions. You can start without signing in on the website.",
  ],
  [
    "What is Verified?",
    "Verified is stricter accountability. It preserves the timer through screen lock, but leaving CommitX can fail the session.",
  ],
  [
    "Can I start without signing in?",
    "Yes. Website visitors can start Standard, Verified, and Focus Class without an account. Guest sessions do not use Cx Coins.",
  ],
  [
    "Can I study with friends?",
    "Yes. Group Study lets signed-in users create or join shared sessions with one shared timer and commitments.",
  ],
  [
    "What is Focus Class?",
    "Focus Class is a public quiet room with live presence, calm sounds, and focused study durations.",
  ],
  [
    "What are Cx Coins?",
    "Cx Coins are in-app points used for commitments. Completed sessions earn 25 Cx Coins per hour, with no cash value.",
  ],
  [
    "What is Focus Shield?",
    "Focus Shield is an optional Standard-mode Android protection that helps block selected distracting apps during a session.",
  ],
] as const;

export function Landing() {
  const [modal, setModal] = useState<Mode | null>(null);
  // Visitors set up their session right here instead of leaving the page.
  const [setup, setSetup] = useState<Mode | null>(null);
  const [focusClassOpen, setFocusClassOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const heroDrift = useScrollDrift(70);
  const [faqOpen, setFaqOpen] = useState(false);
  const faqRef = useRef<HTMLDivElement | null>(null);
  const { count: focusClassCount, loading: focusClassLoading } = useFocusClassCount();
  // Website visitors who are signed in stay on this page; only the account
  // links change so they can reach their saved sessions.
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const { state: appState, hydrated: appHydrated } = useAppState();
  const coinBadge = signedIn && appHydrated ? ` · ${formatCoins(appState.coins)} Cx` : "";

  // Optional dark palette for this page only — remembered between visits.
  const [darkPage, setDarkPage] = useState(false);
  useEffect(() => {
    try {
      setDarkPage(window.localStorage.getItem("commitx.landing.theme") === "dark");
    } catch {
      /* storage unavailable — stay light */
    }
  }, []);
  const toggleDarkPage = () => {
    setDarkPage((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("commitx.landing.theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!faqOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (faqRef.current && !faqRef.current.contains(event.target as Node)) {
        setFaqOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [faqOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function start(mode: Mode) {
    setModal(null);
    setSetup(mode);
  }

  return (
    <div className={`landing-root min-h-dvh scroll-smooth ${darkPage ? "landing-dark" : ""}`}>
      {/* NAV */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? "pt-2" : "pt-3 sm:pt-4"
        }`}
      >
        <nav
          className={`mx-auto grid w-[calc(100%-1.5rem)] max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-full px-5 transition-all duration-500 sm:w-[calc(100%-2.5rem)] sm:px-7 lg:w-[86%] ${
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
            <button
              type="button"
              onClick={toggleDarkPage}
              aria-label={darkPage ? "Switch to light theme" : "Switch to dark theme"}
              title={darkPage ? "Light theme" : "Dark theme"}
              className="rounded-full border border-ink-line/70 p-2 text-ink-soft transition-colors hover:text-ink"
            >
              {darkPage ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to={signedIn ? "/history" : "/auth"}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              {signedIn ? "My sessions" : "Sign in"}
            </Link>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={toggleDarkPage}
              aria-label={darkPage ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-full p-2 text-ink-soft"
            >
              {darkPage ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-full p-2 text-ink"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
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
              to={signedIn ? "/history" : "/auth"}
              onClick={() => setMenuOpen(false)}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-6 py-4 text-sm font-medium text-paper"
            >
              {signedIn ? "My sessions" : "Sign in"}
            </Link>
          </div>
        </div>
      ) : null}

      {/* HERO */}
      <section
        id="top"
        className="relative overflow-hidden px-6 pb-16 pt-28 sm:pb-24 sm:pt-36 lg:px-0"
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
          className="pointer-events-none absolute inset-x-0 top-0 h-[56vh] w-full object-cover opacity-[0.34] will-change-transform"
          style={{
            transform: `translate3d(0, ${heroDrift}px, 0) scale(${1 + heroDrift * 0.0006})`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[56vh]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, color-mix(in oklab, var(--paper) 32%, transparent) 55%, var(--paper) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-[1400px] lg:w-[86%]">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-16">
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
                {signedIn
                  ? "Your sessions are saved to your CommitX account."
                  : "No account required to start."}
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
                { text: "50 min • Anatomy", cls: "left-0 top-2 sm:-left-4", d: "0s", f: 0.5 },
                { text: "🔥 12 day streak", cls: "right-0 top-1/3 sm:-right-5", d: "1.2s", f: -0.7 },
                { text: "+25 Cx Coins", cls: "bottom-4 left-3 sm:left-0", d: "2.1s", f: 0.9 },
              ].map((c) => (
                <div
                  key={c.text}
                  className={`pointer-events-none absolute ${c.cls}`}
                  style={{
                    transform: `translate3d(${tilt.x * 26 * c.f}px, ${tilt.y * 20 * c.f}px, 0)`,
                    transition: "transform 600ms ease-out",
                  }}
                >
                  <div
                    className="animate-gentle-float rounded-2xl border border-ink-line/80 bg-paper/80 px-3.5 py-2 text-[11px] font-medium shadow-[0_16px_40px_-24px_rgb(0_0_0/0.45)] backdrop-blur-md sm:text-xs"
                    style={{ animationDelay: c.d }}
                  >
                    {c.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FOCUS CLASS ENTRY — fills the fold, invites the scroll */}
          <div className="mt-16 sm:mt-20">
            <Reveal>
              <div className="mx-auto grid max-w-5xl gap-5 rounded-[28px] border border-ink-line bg-paper px-6 py-6 shadow-[0_22px_60px_-44px_rgb(0_0_0/0.4)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
                    🌱 Join the Focus Class
                  </p>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] sm:text-[30px]">
                    Students are focusing right now. Join them.
                  </h2>
                  <p className="mt-3 text-sm text-ink-soft">
                    {focusClassLoading ? "Loading live count…" : `${focusClassCount} students focusing now`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusClassOpen(true)}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
                >
                  Join Focus Class
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </Reveal>

            {/* GROUP STUDY ENTRY — create or join from the website */}
            <Reveal>
              <div className="mx-auto mt-5 grid max-w-5xl gap-5 rounded-[28px] border border-ink-line bg-paper px-6 py-6 shadow-[0_22px_60px_-44px_rgb(0_0_0/0.4)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
                    👥 Group Study
                  </p>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] sm:text-[30px]">
                    Prefer to study with your loved ones?
                  </h2>
                  <p className="mt-3 text-sm text-ink-soft">
                    Create a group or join with a code — one shared timer, up to 20 of you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupOpen(true)}
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-ink-line px-6 py-3.5 text-sm font-medium transition-colors hover:border-ink/30"
                >
                  Study together
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </Reveal>

            <div className="mt-10 flex flex-col items-center gap-2 text-ink-soft/70">
              <span className="text-[10px] font-medium uppercase tracking-[0.28em]">
                See how it works
              </span>
              <svg
                className="animate-scroll-cue"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* WHY COMMITX */}
      <section className="px-6 pb-4 sm:pb-8">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: "🪙", title: "25 Cx Coins per hour", sub: "Every focused hour counts" },
            { icon: "🛡️", title: "Two focus modes", sub: "Standard or fully Verified" },
            { icon: "⚡", title: "Start in seconds", sub: "No account required" },
          ].map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-3 rounded-2xl border border-ink-line/70 bg-paper/70 px-4 py-3.5 shadow-[0_18px_44px_-30px_rgb(0_0_0/0.35)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span className="text-xl" aria-hidden>
                {f.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium tracking-[-0.01em]">{f.title}</p>
                <p className="text-[11px] text-ink-soft">{f.sub}</p>
              </div>
            </div>
          ))}
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
              <div className="flex h-full flex-col rounded-[28px] border border-ink-line bg-paper p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/25 hover:shadow-[0_28px_60px_-38px_rgb(0_0_0/0.45)] active:scale-[0.99] sm:p-10">
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
              <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-ink/15 bg-ink p-8 text-paper shadow-[0_24px_60px_-40px_rgb(0_0_0/0.6)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_36px_80px_-40px_rgb(0_0_0/0.65)] active:scale-[0.99] sm:p-10">
                <div
                  aria-hidden
                  className="animate-sun-breathe pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
                  style={{ background: "oklch(0.6 0.1 148 / 0.45)" }}
                />
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

      {/* FOCUS GARDEN */}
      <section className="bg-paper-soft px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
              Focus Garden
            </p>
            <h2 className="mx-auto mt-5 max-w-2xl text-[26px] font-medium leading-[1.15] tracking-[-0.03em] sm:text-[40px]">
              Your focus time, growing quietly.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-soft">
              Slide through a day of study and watch it grow — seed, sprout, plant, tree.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <FocusGarden />
          </Reveal>
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

      <LandingReviews />

      {/* FAQ */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
              FAQ
            </p>
            <h2 className="mt-5 text-[28px] font-medium leading-[1.15] tracking-[-0.03em] sm:text-[42px]">
              Simple answers before you start.
            </h2>
          </Reveal>
          <div ref={faqRef} className="mt-10">
            {faqOpen ? (
              <div className="grid gap-3 md:grid-cols-2">
                {FAQ_ITEMS.map(([question, answer], index) => (
                  <Reveal key={question} delay={(index % 2) * 80}>
                    <details className="group rounded-[22px] border border-ink-line bg-paper/75 px-5 py-4 shadow-[0_18px_44px_-34px_rgb(0_0_0/0.3)] backdrop-blur-sm">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
                        <span>{question}</span>
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-line text-base leading-none text-ink-soft transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 pr-8 text-sm leading-6 text-ink-soft">{answer}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setFaqOpen(true)}
                  className="rounded-full border border-ink-line bg-paper/75 px-7 py-3 text-sm font-medium text-ink shadow-[0_18px_44px_-34px_rgb(0_0_0/0.3)] backdrop-blur-sm transition-colors hover:bg-paper-soft"
                >
                  Show FAQs
                </button>
              </div>
            )}
          </div>
        </div>
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
        <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-5 border-t border-ink-line/60 pt-8">
          <a
            href="https://launchbuff.com/products/commitx-e1h8ub"
            target="_blank"
            rel="noopener noreferrer"
            title="Featured on LaunchBuff"
            className="transition-opacity duration-300 hover:opacity-80"
          >
            <img
              src="https://launchbuff.com/badge-featured-dark.svg"
              alt="Featured on LaunchBuff"
              className="h-14 w-auto"
              width={256}
              height={80}
              loading="lazy"
            />
          </a>
          <a
            href="https://launchstag.com/p/commitx"
            target="_blank"
            rel="noopener noreferrer"
            title="Featured on Launchstag"
            className="transition-opacity duration-300 hover:opacity-80"
          >
            <img
              src="https://launchstag.com/badge-light.svg"
              alt="Featured on Launchstag"
              className="h-14 w-auto"
              width={198}
              height={62}
              loading="lazy"
            />
          </a>
        </div>
      </footer>

      {modal ? (
        <ModeModal
          mode={modal}
          onClose={() => setModal(null)}
          onContinue={() => start(modal)}
        />
      ) : null}

      {setup ? <GuestSetup mode={setup} onClose={() => setSetup(null)} /> : null}
      <FocusClassSetup open={focusClassOpen} onClose={() => setFocusClassOpen(false)} />
      {groupOpen ? <GroupSetup onClose={() => setGroupOpen(false)} /> : null}
    </div>
  );
}
