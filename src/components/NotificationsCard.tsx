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
    <div id="notifications" className="px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Notifications</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={request}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            Allow notifications
          </button>
          <button
            onClick={openSettings}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
          >
            Open Android settings
          </button>
        </div>
      )}

      {!on && (
        <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Notifications are turned off. CommitX won't post any reminders.
        </p>
      )}
    </div>
  );
}
