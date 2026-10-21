import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { useStudyBuddy } from "@/lib/study-buddy";
import { useBuddyCam } from "@/lib/buddy-cam";

function Tile({ stream, muted, mirror, className }: { stream: MediaStream | null; muted: boolean; mirror?: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} object-cover ${mirror ? "-scale-x-100" : ""}`} />;
}

/** In-session study cam with your one Study Buddy. Muted by default, no chat. */
export function BuddyCam() {
  const { user } = useAuth();
  const buddy = useStudyBuddy(Boolean(user));
  const s = buddy.status;
  const cam = useBuddyCam(user?.id ?? null, s?.buddyId ?? null);
  if (!user || !s?.buddyId) return null;
  const first = s.name?.split(" ")[0] ?? "Buddy";

  if (cam.state === "off" || cam.state === "error") {
    return (
      <div className="fixed bottom-5 left-4 z-30 max-w-[60vw]">
        <button
          type="button"
          onClick={() => void cam.start()}
          className="flex items-center gap-2 rounded-full border border-hairline bg-card/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-soft backdrop-blur"
        >
          <Video className="h-4 w-4 text-primary" /> Study cam with {first}
        </button>
        {cam.error && <p className="mt-1 text-[11px] text-destructive">{cam.error}</p>}
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-4 z-30 w-[112px] overflow-hidden rounded-2xl border border-hairline bg-card shadow-lift">
      <div className="relative h-[150px] w-full bg-secondary">
        {cam.remote ? (
          <Tile stream={cam.remote} muted={false} className="h-full w-full" />
        ) : (
          <p className="grid h-full place-items-center px-2 text-center text-[11px] text-muted-foreground">
            Waiting for {first}…
          </p>
        )}
        <Tile stream={cam.local} muted mirror className="absolute bottom-1.5 right-1.5 h-12 w-9 rounded-lg border border-card" />
        <span className="absolute left-1.5 top-1.5 rounded-full bg-background/70 px-1.5 text-[10px] text-foreground">{first}</span>
      </div>
      <div className="flex items-center justify-around py-1.5">
        <button type="button" aria-label={cam.micOn ? "Mute" : "Unmute"} onClick={cam.toggleMic} className={`grid h-8 w-8 place-items-center rounded-full ${cam.micOn ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
          {cam.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button type="button" aria-label={cam.camOn ? "Turn camera off" : "Turn camera on"} onClick={cam.toggleCam} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground">
          {cam.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </button>
        <button type="button" aria-label="Leave study cam" onClick={cam.stop} className="grid h-8 w-8 place-items-center rounded-full bg-destructive/15 text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
