import { Bell, BellOff } from "lucide-react";
import {
  setNotificationsAllowed,
  useNotificationPermission,
} from "@/lib/native-notifications";
import { useAppState } from "@/lib/commitx-store";

/** Turn CommitX notifications on/off (persisted per account) + Android permission. */
export function NotificationsCard() {
  const { supported, enabled, request, openSettings } = useNotificationPermission();
  const { state, hydrated } = useAppState();
  const on = hydrated ? state.notificationsEnabled !== false : true;

  return (
    <div id="notifications" className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Notifications</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Today's to-do checklist, live study progress, plan reminders and
            screen-time alerts.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Turn notifications off" : "Turn notifications on"}
          onClick={() => setNotificationsAllowed(!on)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? "bg-primary" : "bg-secondary"
          }`}
        >
          <span
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow-soft transition-transform"
            style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {on && supported && enabled === false && (
        <div className="mt-4 grid gap-2">
          <p className="text-xs text-muted-foreground">
            Android hasn't granted notification permission yet.
          </p>
          <button
            onClick={request}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            Allow notifications
          </button>
          <button
            onClick={openSettings}
            className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
          >
            Open Android settings
          </button>
        </div>
      )}

      {!on && (
        <p className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
          Notifications are turned off. CommitX won't post any reminders.
        </p>
      )}
    </div>
  );
}
