import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hourglass } from "@/components/Hourglass";

/** A single native welcome; permissions remain in their existing feature flows. */
export function NativeWelcome({ onDone }: { onDone: () => void }) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="native-welcome-title"
      className="fixed inset-0 z-50 flex flex-col bg-background px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-foreground animate-in fade-in duration-300 motion-reduce:animate-none"
    >
      <p className="text-center font-display text-sm font-semibold">CommitX</p>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-7 py-8 text-center">
        <Hourglass size={160} state="idle" />
        <div>
          <h1 id="native-welcome-title" className="font-display text-3xl font-semibold leading-tight">
            One promise.<br />Your focus.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Commit. Complete. Get It Back.
          </p>
        </div>
      </div>
      <Button onClick={onDone} className="mx-auto h-12 w-full max-w-sm rounded-full">
        Let’s begin <ArrowRight aria-hidden="true" />
      </Button>
    </section>
  );
}