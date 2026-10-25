import { useEffect, useRef, useState } from "react";
import { Maximize2, Mic, MicOff, Minimize2, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { useStudyBuddy } from "@/lib/study-buddy";
import { useBuddyCam } from "@/lib/buddy-cam";
import { registerNativeModal } from "@/lib/native-session";

function Tile({ stream, muted, mirror, className }: { stream: MediaStream | null; muted: boolean; mirror?: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} object-cover ${mirror ? "-scale-x-100" : ""}`} />;
}

function CamControls({
  cam,
  onLeave,
  extra,
  size = "small",
}: {
  cam: ReturnType<typeof useBuddyCam>;
  onLeave: () => void;
  extra?: React.ReactNode;
  size?: "small" | "large";
}) {
  const btn = size === "large" ? "grid h-12 w-12 place-items-center rounded-full" : "grid h-8 w-8 place-items-center rounded-full";
  const icon = size === "large" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className={`flex items-center justify-around ${size === "large" ? "gap-6 py-3" : "py-1.5"}`}>
      <button type="button" aria-label={cam.micOn ? "Mute" : "Unmute"} onClick={cam.toggleMic} className={`${btn} ${cam.micOn ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
        {cam.micOn ? <Mic className={icon} /> : <MicOff className={icon} />}
      </button>
      <button type="button" aria-label={cam.camOn ? "Turn camera off" : "Turn camera on"} onClick={cam.toggleCam} className={`${btn} bg-secondary text-muted-foreground`}>
        {cam.camOn ? <Video className={icon} /> : <VideoOff className={icon} />}
      </button>
      {extra}
      <button type="button" aria-label="Leave study cam" onClick={onLeave} className={`${btn} bg-destructive/15 text-destructive`}>
        <X className={icon} />
      </button>
    </div>
  );
}

/** In-session study cam with your one Study Buddy. Muted by default, no chat. */
export function BuddyCam() {
  const { user } = useAuth();
  const buddy = useStudyBuddy(Boolean(user));
  const s = buddy.status;
  const cam = useBuddyCam(user?.id ?? null, s?.buddyId ?? null);
  const [full, setFull] = useState(false);
  const [waitingLong, setWaitingLong] = useState(false);

  // Android Back minimizes the fullscreen cam instead of leaving the session.
  useEffect(() => {
    if (!full) return;
    return registerNativeModal(() => setFull(false));
  }, [full]);

  // After 20s of waiting, tell the user what to do instead of spinning forever.
  useEffect(() => {
    if (cam.state !== "waiting") { setWaitingLong(false); return; }
    const t = window.setTimeout(() => setWaitingLong(true), 20_000);
    return () => window.clearTimeout(t);
  }, [cam.state]);

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

  const waitingText = waitingLong ? `Ask ${first} to tap “Study cam” too` : `Waiting for ${first}…`;

  const videoArea = (className: string, localClass: string) => (
    <div className={`relative bg-secondary ${className}`}>
      {cam.remote ? (
        <Tile stream={cam.remote} muted={false} className="h-full w-full" />
      ) : (
        <p className="grid h-full place-items-center px-3 text-center text-[11px] text-muted-foreground">{waitingText}</p>
      )}
      <Tile stream={cam.local} muted mirror className={`absolute rounded-lg border border-card ${localClass}`} />
      <span className="absolute left-1.5 top-1.5 rounded-full bg-background/70 px-1.5 text-[10px] text-foreground">{first}</span>
    </div>
  );

  return (
    <>
      {/* Floating mini panel over the timer */}
      <div className="fixed bottom-5 left-4 z-30 w-[112px] overflow-hidden rounded-2xl border border-hairline bg-card shadow-lift">
        <button type="button" aria-label="Open study cam full screen" onClick={() => setFull(true)} className="block w-full text-left">
          {videoArea("h-[150px] w-full", "bottom-1.5 right-1.5 h-12 w-9")}
        </button>
        <CamControls
          cam={cam}
          onLeave={cam.stop}
          extra={
            <button type="button" aria-label="Full screen" onClick={() => setFull(true)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Maximize2 className="h-4 w-4" />
            </button>
          }
        />
      </div>

      {/* Fullscreen view; minimize returns to the timer */}
      {full && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <button type="button" aria-label="Minimize study cam" onClick={() => setFull(false)} className="relative min-h-0 flex-1">
            {videoArea("h-full w-full", "right-3 top-3 h-28 w-20")}
            <span className="sr-only">Minimize</span>
          </button>
          <div className="shrink-0 border-t border-hairline bg-card">
            <CamControls
              cam={cam}
              size="large"
              onLeave={() => { setFull(false); cam.stop(); }}
              extra={
                <button type="button" aria-label="Minimize and return to timer" onClick={() => setFull(false)} className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground">
                  <Minimize2 className="h-5 w-5" />
                </button>
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
