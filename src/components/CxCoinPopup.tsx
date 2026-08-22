import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CxCoin } from "./CxCoin";

interface CxCoinPopupProps {
  children: React.ReactNode;
  coins: number;
  hydrated?: boolean;
}

/** Smooth count-up from 0 to the user's coin balance. */
function useCountUp(target: number, duration = 700, delay = 120) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(target * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

export function CxCoinPopup({ children, coins, hydrated = true }: CxCoinPopupProps) {
  const [open, setOpen] = useState(false);
  const animated = useCountUp(open ? coins : 0);
  const display = open ? Math.max(0, Math.round(animated)) : coins;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="inline-flex items-center justify-center bg-transparent p-0 font-inherit text-inherit"
        asChild
      >
        {children}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-[2rem] border border-hairline bg-card p-6 shadow-lift",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Warm ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
          />

          <DialogPrimitive.Close
            className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="relative flex flex-col items-center text-center">
            {/* Floating coin illustration */}
            <div className="relative">
              <div className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-accent/30 blur-2xl" />
              <div className="relative animate-gentle-float">
                <CxCoin className="h-20 w-20 drop-shadow-lg" />
              </div>
              {/* Soft shimmer sweep */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
              >
                <div className="h-full w-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              </div>
            </div>

            <DialogPrimitive.Title className="mt-5 font-display text-lg font-semibold text-foreground">
              Your Cx Coins
            </DialogPrimitive.Title>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold tabular-nums text-foreground">
                {hydrated ? display : "—"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {hydrated && coins === 1 ? "coin" : "coins"}
              </span>
            </div>

            <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-muted-foreground">
              Keep earning to unlock rewards and coupons in the future!
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3.5 py-1.5 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Earned from focus sessions
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
