import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setAccountabilityStyle,
  useAccountabilityStyle,
  type AccountabilityStyle,
} from "@/lib/accountability";

const OPTIONS: { id: AccountabilityStyle; label: string; sample: string }[] = [
  { id: "gentle", label: "Gentle", sample: "Your commitment is waiting for you 👀" },
  { id: "sarcastic", label: "Sarcastic", sample: "You committed to 2 hours. Your commitment would like to know where you are." },
  { id: "savage", label: "Savage", sample: "Why did you install CommitX if you're not going to keep your commitments?" },
  { id: "brutal", label: "Brutal", sample: "Another commitment abandoned. At this point, your promises need a backup plan." },
  { id: "off", label: "Off", sample: "No roast notifications. Your commitments will judge you silently." },
];

/** Accountability Style (Roast Mode) picker. */
export function AccountabilityCard() {
  const style = useAccountabilityStyle();
  const current = OPTIONS.find((o) => o.id === style) ?? OPTIONS[1];
  return (
    <div id="accountability" className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <Flame className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Accountability style</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            How CommitX calls you out about the commitments you make. Max 3 a day, never during a session or at night (10 PM – 8 AM).
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Accountability style">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={style === o.id}
            onClick={() => setAccountabilityStyle(o.id)}
            className={cn(
              "h-9 rounded-full border px-4 text-xs font-medium transition-colors",
              style === o.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-hairline bg-background text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs italic leading-relaxed text-muted-foreground">
        “{current.sample}”
      </p>
    </div>
  );
}
