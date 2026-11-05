import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-hairline bg-card p-3 shadow-soft"
          >
            <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">Offline · changes saved on this device</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Dismiss offline notice"
              type="button"
              onClick={() => setShowOffline(false)}
              className="h-7 w-7 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
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
