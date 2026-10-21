import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/buddy/$code")({
  head: () => ({
    meta: [
      { title: "Join my CommitX Study Buddy" },
      { name: "description", content: "Pair up on CommitX and keep each other accountable for every study session." },
      { property: "og:title", content: "Join my CommitX Study Buddy" },
      { property: "og:description", content: "Pair up on CommitX and keep each other accountable for every study session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuddyInvite,
});

function BuddyInvite() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preview, setPreview] = useState<{ name: string; status: string } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.rpc("buddy_invite_preview", { _code: code }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      setPreview(row ? { name: row.inviter_name, status: row.status } : null);
    });
  }, [user, code]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_buddy_invite", { _code: code });
    setBusy(false);
    if (err) setError(err.message);
    else navigate({ to: "/", replace: true });
  };

  const valid = preview && preview.status === "pending";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-primary">
        <HeartHandshake className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold">
        {valid ? `${preview.name} wants you as their Study Buddy` : preview === null || (preview && !valid) ? "This invite is no longer valid" : "Study Buddy invite"}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        You'll both see when the other starts, finishes or gives up a session — and can nudge each other to study.
      </p>
      {valid && (
        <Button className="mt-8 h-14 w-full max-w-xs rounded-full" disabled={busy} onClick={accept}>
          {busy ? "Joining…" : "Accept & pair up"}
        </Button>
      )}
      {error && <p className="mt-3 max-w-xs text-xs text-destructive">{error}</p>}
      <Link to="/" replace className="mt-4 text-sm text-muted-foreground underline">Go Home</Link>
    </div>
  );
}
