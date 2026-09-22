import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Play, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusClassAudio, type FocusClassSound } from "@/lib/focus-class";

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

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface FocusClassSetupProps {
  open: boolean;
  onClose: () => void;
}

export function FocusClassSetup({ open, onClose }: FocusClassSetupProps) {
  const navigate = useNavigate();
  const audio = useFocusClassAudio();
  const [step, setStep] = useState<"duration" | "sound">("duration");
  const [duration, setDuration] = useState(25);
  const [custom, setCustom] = useState(false);
  const [sound, setSound] = useState<FocusClassSound>("silence");

  useEffect(() => {
    if (open) {
      setStep("duration");
      setDuration(25);
      setCustom(false);
      setSound("silence");
    } else {
      audio.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickDuration = (minutes: number, isCustom: boolean) => {
    setCustom(isCustom);
    setDuration(minutes);
    setStep("sound");
  };

  const start = () => {
    audio.stop();
    onClose();
    void navigate({
      to: "/focus-class",
      search: { start: true, duration, sound },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Set up your Focus Class"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-[28px] border border-ink-line bg-paper shadow-[0_40px_120px_-40px_rgb(0_0_0/0.5)]">
        <div className="flex items-center justify-between px-6 pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-ink-soft">
            🌱 Focus Class
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-ink-line p-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "duration" ? (
          <div className="px-6 pb-7 pt-4">
            <h2 className="text-xl font-medium tracking-[-0.02em]">Set up your class</h2>
            <p className="mt-1.5 text-sm text-ink-soft">How long will you focus?</p>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIXED_DURATIONS.map((minutes) => (
                <button
                  type="button"
                  key={minutes}
                  onClick={() => pickDuration(minutes, false)}
                  className={cn(
                    "h-12 rounded-2xl border border-ink-line text-sm font-medium text-ink-soft transition-all hover:-translate-y-0.5 hover:border-ink/30 hover:text-ink",
                    !custom && duration === minutes && "border-ink text-ink",
                  )}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustom(true)}
                className={cn(
                  "h-12 rounded-2xl border border-ink-line text-sm font-medium text-ink-soft transition-all hover:-translate-y-0.5 hover:border-ink/30 hover:text-ink",
                  custom && "border-ink text-ink",
                )}
              >
                Custom
              </button>
            </div>

            {custom ? (
              <div className="mt-4 rounded-3xl border border-ink-line/80 bg-paper-soft/40 p-3">
                <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-1 py-1">
                  {CUSTOM_DURATIONS.map((minutes) => (
                    <button
                      type="button"
                      key={minutes}
                      onClick={() => pickDuration(minutes, true)}
                      className="shrink-0 snap-center rounded-full border border-ink-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
                    >
                      {formatDuration(minutes)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-5 text-center text-[11px] text-ink-soft/70">
              Pick a time to continue
            </p>
          </div>
        ) : (
          <div className="px-6 pb-7 pt-4">
            <button
              type="button"
              onClick={() => setStep("duration")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {formatDuration(duration)}
            </button>
            <h2 className="mt-2 text-xl font-medium tracking-[-0.02em]">
              🎧 Want a calm sound while you focus?
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">Optional — preview any sound first.</p>

            <div className="mt-5 grid gap-2">
              {SOUNDS.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-ink-line bg-paper p-2 transition-colors",
                    sound === item.id && "border-ink bg-paper-soft/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSound(item.id)}
                    className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left"
                  >
                    <span aria-hidden>{item.emoji}</span>
                    <span className="truncate text-sm font-medium">{item.label}</span>
                  </button>
                  {item.preview ? (
                    <button
                      type="button"
                      onClick={() => void audio.preview(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  ) : (
                    <span className="pr-3 text-ink-soft/60">
                      <VolumeX className="h-4 w-4" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={start}
              className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              Start Focusing
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
