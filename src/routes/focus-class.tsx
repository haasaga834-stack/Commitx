import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  completeFocusClassPresence,
  fetchFocusClassCount,
  getFocusClassPresenceKey,
  HEARTBEAT_MS,
  leaveFocusClassPresence,
  touchFocusClassPresence,
  useFocusClassAudio,
  useFocusClassCount,
  type FocusClassSound,
} from "@/lib/focus-class";
import { supabase } from "@/integrations/supabase/client";

const focusClassSearch = z.object({
  start: z.boolean().optional(),
  duration: z.coerce.number().optional(),
  sound: z
    .enum(["rain", "forest", "ocean", "campfire", "deep-focus", "silence"])
    .optional(),
});

export const Route = createFileRoute("/focus-class")({
  validateSearch: focusClassSearch,
  head: () => ({
    meta: [
      { title: "CommitX — Focus Class" },
      {
        name: "description",
        content:
          "Join a quiet shared study room and focus alongside the real CommitX community.",
      },
      { property: "og:title", content: "CommitX — Focus Class" },
      {
        property: "og:description",
        content:
          "A calm shared focus room with real live presence, quiet ambience, and no signup required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CommitX — Focus Class" },
      {
        name: "twitter:description",
        content:
          "A calm shared focus room with real live presence, quiet ambience, and no signup required.",
      },
    ],
  }),
  component: FocusClassPage,
});

type Phase = "setup" | "focus" | "complete";

const FIXED_DURATIONS = [25, 50, 90] as const;
const CUSTOM_DURATIONS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

const SOUNDS: { id: FocusClassSound; label: string; emoji: string; preview: boolean }[] = [
  { id: "rain", label: "Soft Rain", emoji: "🌧️", preview: true },
  { id: "forest", label: "Forest", emoji: "🌲", preview: true },
  { id: "ocean", label: "Ocean", emoji: "🌊", preview: true },
  { id: "campfire", label: "Campfire", emoji: "🔥", preview: true },
  { id: "deep-focus", label: "Deep Focus", emoji: "🎹", preview: true },
  { id: "silence", label: "Silence", emoji: "🔇", preview: false },
];

interface Notice {
  id: number;
  text: string;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function FocusClassPage() {
  const search = Route.useSearch();
  const preset = useMemo(() => {
    const raw = typeof search.duration === "number" ? Math.round(search.duration) : 25;
    const d = Math.min(360, Math.max(25, raw));
    const isCustom = !(FIXED_DURATIONS as readonly number[]).includes(d);
    return {
      duration: isCustom ? 25 : d,
      custom: isCustom,
      customDuration: isCustom ? d : 120,
      sound: (search.sound ?? "silence") as FocusClassSound,
    };
    // Captured once on mount — search params only seed the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { count: lobbyCount, loading } = useFocusClassCount();
  const [phase, setPhase] = useState<Phase>("setup");
  const [duration, setDuration] = useState(preset.duration);
  const [customDuration, setCustomDuration] = useState(preset.customDuration);
  const [custom, setCustom] = useState(preset.custom);
  const [sound, setSound] = useState<FocusClassSound>(preset.sound);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activeCount, setActiveCount] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [completedAlongside, setCompletedAlongside] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [presenceKey, setPresenceKey] = useState("");
  const audio = useFocusClassAudio();
  const activeRef = useRef(false);
  const finishingRef = useRef(false);
  const lastCountRef = useRef<number | null>(null);
  const noticeIdRef = useRef(0);

  const selectedDuration = custom ? customDuration : duration;
  const remainingMs = startedAt
    ? Math.max(0, selectedDuration * 60_000 - (now - startedAt))
    : selectedDuration * 60_000;
  const otherStudents = Math.max(0, activeCount - (phase === "focus" ? 1 : 0));

  useEffect(() => {
    setPresenceKey(getFocusClassPresenceKey());
  }, []);

  const pushNotice = useCallback((text: string) => {
    const id = noticeIdRef.current + 1;
    noticeIdRef.current = id;
    setNotices((items) => [...items.slice(-2), { id, text }]);
    window.setTimeout(() => {
      setNotices((items) => items.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const next = await fetchFocusClassCount();
      setActiveCount(next);
      const previous = lastCountRef.current;
      if (previous !== null && next > previous && activeRef.current) {
        const delta = next - previous;
        pushNotice(delta === 1 ? "🌱 Someone just joined" : `🌱 ${delta} students joined`);
      }
      lastCountRef.current = next;
    } catch {}
  }, [pushNotice]);

  useEffect(() => {
    if (phase !== "focus" || startedAt === null) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "focus") return;
    activeRef.current = true;
    let stopped = false;
    const beat = async () => {
      try {
        const next = await touchFocusClassPresence(presenceKey, selectedDuration, sound);
        if (!stopped) {
          setActiveCount(next);
          lastCountRef.current = next;
        }
      } catch {}
    };
    void beat();
    const heartbeat = window.setInterval(beat, HEARTBEAT_MS);
    const countPoll = window.setInterval(refreshCount, 12_000);
    const channel = supabase
      .channel(`focus-class-room-${presenceKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "focus_class_presence" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { presence_key?: string; status?: string };
          if (row.presence_key !== presenceKey && row.status === "completed") {
            pushNotice("✨ A student completed their focus");
          }
          void refreshCount();
        },
      )
      .subscribe();

    return () => {
      stopped = true;
      activeRef.current = false;
      window.clearInterval(heartbeat);
      window.clearInterval(countPoll);
      void supabase.removeChannel(channel);
      if (!finishingRef.current) void leaveFocusClassPresence(presenceKey).catch(() => {});
    };
  }, [phase, presenceKey, refreshCount, selectedDuration, sound, pushNotice]);

  useEffect(() => {
    if (phase !== "focus" || remainingMs > 0) return;
    void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingMs]);

  async function startFocus() {
    if (!presenceKey) return;
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    setPhase("focus");
    finishingRef.current = false;
    try {
      if (sound !== "silence") {
        await audio.play(sound);
        setAudioOn(true);
      }
      const next = await touchFocusClassPresence(presenceKey, selectedDuration, sound);
      setActiveCount(next);
      lastCountRef.current = next;
    } catch {
      setActiveCount(0);
      lastCountRef.current = 0;
    }
  }

  async function finish() {
    if (phase !== "focus") return;
    finishingRef.current = true;
    setCompletedAlongside(Math.max(0, activeCount - 1));
    setPhase("complete");
    activeRef.current = false;
    audio.stop();
    setAudioOn(false);
    try {
      const next = await completeFocusClassPresence(presenceKey);
      setActiveCount(next);
      lastCountRef.current = next;
    } catch {}
  }

  function focusAgain() {
    finishingRef.current = false;
    setPhase("setup");
    setStartedAt(null);
    setNow(Date.now());
    setCompletedAlongside(0);
    setNotices([]);
  }

  return (
    <main className="focus-class-root relative min-h-dvh overflow-hidden bg-focus-night text-focus-foreground">
      <QuietForest />
      <div className="pointer-events-none fixed inset-x-0 top-5 z-30 flex flex-col items-center gap-2 px-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="animate-focus-notice rounded-full border border-focus-line bg-focus-panel/80 px-4 py-2 text-xs font-medium text-focus-foreground shadow-[0_18px_50px_-30px_var(--focus-shadow)] backdrop-blur-xl"
          >
            {notice.text}
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-focus-line bg-focus-panel/45 px-3.5 py-2 text-xs font-medium text-focus-muted backdrop-blur-xl transition-colors hover:text-focus-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            CommitX
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-focus-line bg-focus-panel/45 px-3.5 py-2 text-xs font-medium text-focus-muted backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-focus-live shadow-[0_0_14px_var(--focus-live)]" />
            LIVE
          </div>
        </header>

        {phase === "setup" ? (
          <section className="flex flex-1 items-center justify-center py-10 sm:py-14">
            <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)]">
              <div className="text-center lg:text-left">
                <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-focus-muted">
                  Focus Class
                </p>
                <div className="mt-8 flex items-end justify-center gap-3 lg:justify-start">
                  <span className="text-7xl font-semibold leading-none tracking-normal text-focus-foreground sm:text-8xl">
                    {loading ? "—" : lobbyCount}
                  </span>
                  <span className="mb-3 max-w-32 text-left text-sm leading-tight text-focus-muted">
                    students focusing right now
                  </span>
                </div>
                <p className="mx-auto mt-8 max-w-lg text-base leading-relaxed text-focus-muted lg:mx-0">
                  A shared quiet study room. No names, no photos, no feed — just real students focusing together.
                </p>
              </div>

              <div className="rounded-[28px] border border-focus-line bg-focus-panel/70 p-5 shadow-[0_30px_90px_-55px_var(--focus-shadow)] backdrop-blur-2xl sm:p-6">
                <h1 className="text-xl font-semibold tracking-normal text-focus-foreground">
                  Set up your class
                </h1>

                <div className="mt-6">
                  <p className="text-sm font-medium text-focus-foreground">How long will you commit?</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FIXED_DURATIONS.map((minutes) => (
                      <Button
                        type="button"
                        key={minutes}
                        variant="ghost"
                        onClick={() => {
                          setCustom(false);
                          setDuration(minutes);
                        }}
                        className={cn(
                          "h-12 rounded-2xl border border-focus-line bg-focus-panel/55 text-focus-muted hover:bg-focus-panel hover:text-focus-foreground",
                          !custom && duration === minutes && "border-focus-accent text-focus-foreground",
                        )}
                      >
                        {minutes} min
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCustom(true)}
                      className={cn(
                        "h-12 rounded-2xl border border-focus-line bg-focus-panel/55 text-focus-muted hover:bg-focus-panel hover:text-focus-foreground",
                        custom && "border-focus-accent text-focus-foreground",
                      )}
                    >
                      Custom
                    </Button>
                  </div>
                  {custom ? (
                    <div className="mt-4 rounded-3xl border border-focus-line bg-focus-deep/35 p-3">
                      <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-1 py-1">
                        {CUSTOM_DURATIONS.map((minutes) => (
                          <button
                            type="button"
                            key={minutes}
                            onClick={() => setCustomDuration(minutes)}
                            className={cn(
                              "shrink-0 snap-center rounded-full border border-focus-line px-4 py-2 text-sm text-focus-muted transition-colors",
                              customDuration === minutes && "border-focus-accent bg-focus-panel text-focus-foreground",
                            )}
                          >
                            {formatDuration(minutes)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-7">
                  <p className="text-sm font-medium text-focus-foreground">
                    🎧 Want a calm sound while you focus?
                  </p>
                  <div className="mt-3 grid gap-2">
                    {SOUNDS.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-focus-line bg-focus-panel/45 p-2 transition-colors",
                          sound === item.id && "border-focus-accent bg-focus-panel/75",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSound(item.id)}
                          className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left"
                        >
                          <span aria-hidden>{item.emoji}</span>
                          <span className="truncate text-sm font-medium text-focus-foreground">
                            {item.label}
                          </span>
                        </button>
                        {item.preview ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void audio.preview(item.id)}
                            className="rounded-full text-focus-muted hover:bg-focus-deep/50 hover:text-focus-foreground"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                        ) : (
                          <span className="pr-3 text-focus-muted">
                            <VolumeX className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => void startFocus()}
                  disabled={!presenceKey}
                  className="mt-7 h-12 w-full rounded-full bg-focus-accent text-focus-accent-foreground hover:bg-focus-accent/90"
                >
                  Start Focusing
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {phase === "focus" ? (
          <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <p className="rounded-full border border-focus-line bg-focus-panel/55 px-4 py-2 text-sm text-focus-muted backdrop-blur-xl">
              🌱 You're focusing with {otherStudents} other students
            </p>
            <div className="mt-10 text-[76px] font-semibold leading-none tracking-normal text-focus-foreground sm:text-[118px]">
              {formatClock(remainingMs)}
            </div>
            <p className="mt-5 text-sm text-focus-muted">{formatDuration(selectedDuration)} Focus Class</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (audioOn) {
                    audio.stop();
                    setAudioOn(false);
                  } else {
                    void audio.play(sound);
                    setAudioOn(sound !== "silence");
                  }
                }}
                className="rounded-full border border-focus-line bg-focus-panel/45 text-focus-muted hover:bg-focus-panel hover:text-focus-foreground"
                disabled={sound === "silence"}
              >
                {audioOn ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {audioOn ? "Pause sound" : sound === "silence" ? "Silence" : "Resume sound"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void finish()}
                className="rounded-full border border-focus-line bg-focus-panel/45 text-focus-muted hover:bg-focus-panel hover:text-focus-foreground"
              >
                Complete
              </Button>
            </div>
          </section>
        ) : null}

        {phase === "complete" ? (
          <section className="flex flex-1 items-center justify-center py-10 text-center">
            <div className="w-full max-w-lg rounded-[30px] border border-focus-line bg-focus-panel/72 p-8 shadow-[0_30px_90px_-55px_var(--focus-shadow)] backdrop-blur-2xl sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-focus-accent text-2xl text-focus-accent-foreground">
                🌱
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-normal text-focus-foreground">
                You did it. 🌱
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-focus-muted">
                You focused for {formatDuration(selectedDuration)} alongside {completedAlongside} students.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={focusAgain}
                  className="h-11 rounded-full bg-focus-accent text-focus-accent-foreground hover:bg-focus-accent/90"
                >
                  Focus Again
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 rounded-full border border-focus-line bg-focus-panel/40 text-focus-foreground hover:bg-focus-panel"
                >
                  <Link to="/">Back to CommitX</Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function QuietForest() {
  const fireflies = useMemo(
    () => [
      [18, 34, "0s"],
      [30, 68, "5s"],
      [44, 26, "9s"],
      [58, 72, "2s"],
      [72, 38, "7s"],
      [84, 61, "12s"],
    ] as const,
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,var(--focus-moonlight),transparent_34%),linear-gradient(180deg,var(--focus-sky-top),var(--focus-sky-mid)_52%,var(--focus-sky-bottom))]" />
      <div className="animate-focus-mist absolute inset-x-[-12%] top-[18%] h-44 bg-[linear-gradient(90deg,transparent,var(--focus-mist),transparent)] blur-3xl" />
      <div className="animate-focus-mist-slow absolute inset-x-[-18%] bottom-[22%] h-32 bg-[linear-gradient(90deg,transparent,var(--focus-mist-low),transparent)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,var(--focus-ground))]" />
      <div className="absolute left-[-9rem] top-0 h-full w-64 bg-[linear-gradient(90deg,var(--focus-tree),transparent)] opacity-80" />
      <div className="absolute right-[-9rem] top-0 h-full w-64 bg-[linear-gradient(270deg,var(--focus-tree),transparent)] opacity-80" />
      <div className="animate-focus-leaves absolute left-0 top-0 h-full w-24 bg-[radial-gradient(ellipse_at_20%_20%,var(--focus-leaf),transparent_32%),radial-gradient(ellipse_at_65%_45%,var(--focus-leaf-soft),transparent_34%),radial-gradient(ellipse_at_32%_74%,var(--focus-leaf),transparent_30%)] blur-sm sm:w-36" />
      <div className="animate-focus-leaves-reverse absolute right-0 top-0 h-full w-24 bg-[radial-gradient(ellipse_at_80%_18%,var(--focus-leaf),transparent_32%),radial-gradient(ellipse_at_35%_50%,var(--focus-leaf-soft),transparent_34%),radial-gradient(ellipse_at_68%_78%,var(--focus-leaf),transparent_30%)] blur-sm sm:w-36" />
      <div className="absolute inset-x-[12%] bottom-[18%] h-32 bg-[radial-gradient(ellipse_at_center,var(--focus-depth),transparent_70%)] blur-xl" />
      {fireflies.map(([left, top, delay]) => (
        <span
          key={`${left}-${top}`}
          className="animate-focus-firefly absolute h-1.5 w-1.5 rounded-full bg-focus-firefly shadow-[0_0_18px_var(--focus-firefly)]"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: delay }}
        />
      ))}
      <div className="animate-focus-particles absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,var(--focus-particle)_0_1px,transparent_2px),radial-gradient(circle_at_74%_36%,var(--focus-particle)_0_1px,transparent_2px),radial-gradient(circle_at_52%_76%,var(--focus-particle)_0_1px,transparent_2px)]" />
    </div>
  );
}