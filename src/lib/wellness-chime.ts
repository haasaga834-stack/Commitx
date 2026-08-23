/**
 * Calm chime + vibration used to announce a wellness break and its end.
 * Everything is best-effort: blocked audio or unsupported vibration never
 * affects session state.
 */

type Ctor = typeof AudioContext;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, at: number, dur = 1.1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.18, at + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(pattern as number[]);
    }
  } catch {}
}

/** Three soft ascending notes — clear but never jarring. */
export function playWellnessChime() {
  const ctx = audioCtx();
  if (!ctx) return;
  try {
    void ctx.resume?.();
    const now = ctx.currentTime + 0.02;
    tone(ctx, 587.33, now); // D5
    tone(ctx, 783.99, now + 0.32); // G5
    tone(ctx, 1046.5, now + 0.64, 1.4); // C6
    window.setTimeout(() => {
      try {
        void ctx.close();
      } catch {}
    }, 3000);
  } catch {}
}

/** Break start: chime + a gentle double buzz. */
function nativeBridge() {
  return typeof window === "undefined" ? undefined : window.CommitXAndroid;
}

export function scheduleWellnessSound(eventKey: string, kind: "start" | "end", fireAt: number) {
  try {
    nativeBridge()?.scheduleWellnessSound?.(eventKey, kind, fireAt);
  } catch {}
}

export function cancelWellnessSounds(sessionPrefix: string) {
  try {
    nativeBridge()?.cancelWellnessSounds?.(sessionPrefix);
  } catch {}
}

export function announceWellnessBreak(eventKey?: string) {
  const native = nativeBridge();
  if (native?.playWellnessSound && eventKey) {
    try {
      native.playWellnessSound(eventKey, "start");
      return;
    } catch {}
  }
  playWellnessChime();
  vibrate([0, 220, 140, 220]);
}

/** Break finished: chime + a shorter nudge to come back to CommitX. */
export function announceBreakOver(eventKey?: string) {
  const native = nativeBridge();
  if (native?.playWellnessSound && eventKey) {
    try {
      native.playWellnessSound(eventKey, "end");
      return;
    } catch {}
  }
  playWellnessChime();
  vibrate([0, 320, 180, 320, 180, 320]);
}
