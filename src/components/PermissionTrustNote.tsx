import { ShieldCheck } from "lucide-react";

/** Explains Android's generic permission warning before users see it. */
export function PermissionTrustNote() {
  return (
    <div className="mt-4 rounded-2xl border border-hairline bg-background p-4 text-xs leading-relaxed text-muted-foreground">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        Safe & private, on your phone only
      </p>
      <p className="mt-2">
        Android shows a standard security warning for <strong>every</strong> app that blocks apps or
        tracks screen time (including Digital Wellbeing-style apps). This is normal.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>CommitX only checks which app is open, to show your focus reminder.</li>
        <li>We never read your screen, messages, passwords or typing.</li>
        <li>Your usage data never leaves this phone.</li>
      </ul>
      <p className="mt-2">
        On Xiaomi, Realme, Vivo or Samsung you may see a short countdown before you can allow it. Just wait and tap Allow.
      </p>
    </div>
  );
}
