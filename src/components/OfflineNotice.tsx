import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";

import {
  isOnline,
  startConnectivityWatch,
  subscribeConnectivity,
} from "@/lib/connectivity";

/**
 * Calm, non-blocking offline notice. It appears once per offline stretch and
 * never interrupts an active session — offline-capable features keep working.
 */
export function OfflineNotice() {
  const [showOffline, setShowOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const shownForThisOutage = useRef(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    startConnectivityWatch();

    const apply = (online: boolean) => {
      if (!online) {
        setShowBackOnline(false);
        if (!shownForThisOutage.current) {
          shownForThisOutage.current = true;
          wasOffline.current = true;
          setShowOffline(true);
        }
        return;
      }
      shownForThisOutage.current = false;
      setShowOffline(false);
      if (wasOffline.current) {
        wasOffline.current = false;
        setShowBackOnline(true);
      }
    };

    if (!isOnline()) apply(false);
    return subscribeConnectivity(apply);
  }, []);

  useEffect(() => {
    if (!showBackOnline) return;
    const t = setTimeout(() => setShowBackOnline(false), 2600);
    return () => clearTimeout(t);
  }, [showBackOnline]);

  return (
    <>
      {showOffline ? (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 px-5 pb-8 sm:items-center sm:pb-0">
          <div
            role="status"
            className="pointer-events-auto w-full max-w-sm animate-[offline-in_260ms_ease-out] rounded-3xl border border-hairline bg-card p-6 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <CloudOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              You're Offline
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Some functions may not be available without a network connection.
              Please connect to the internet to use all CommitX features.
            </p>
            <button
              type="button"
              onClick={() => setShowOffline(false)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {showBackOnline ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-5">
          <div className="animate-[offline-in_220ms_ease-out] flex items-center gap-2 rounded-full border border-hairline bg-card px-4 py-2 shadow-lg">
            <Wifi className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Back online</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
