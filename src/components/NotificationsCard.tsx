import { Bell, BellOff, Check } from "lucide-react";
import { useNotificationPermission } from "@/lib/native-notifications";

/** Lets users enable the to-do, study-progress and screen-time notifications. */
export function NotificationsCard() {
  const { supported, enabled, request, openSettings } = useNotificationPermission();

  if (!supported) return null;

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-sm font-medium">Notifications</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Today's to-do checklist, live study progress and screen-time limit
            alerts.
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Notifications are enabled.
          </span>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <button
            onClick={request}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            Enable notifications
          </button>
          <button
            onClick={openSettings}
            className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground"
          >
            Open Android settings
          </button>
        </div>
      )}
    </div>
  );
}
