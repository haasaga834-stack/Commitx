import { useEffect, useRef, useState } from "react";
import rainUrl from "@/assets/sounds/rain.mp3";
import rainSoftUrl from "@/assets/sounds/rain-soft.mp3";
import streamUrl from "@/assets/sounds/stream.mp3";
import forestUrl from "@/assets/sounds/forest.mp3";
import { Headphones, Volume2, VolumeX, X } from "lucide-react";

/**
 * In-session ambient sounds, generated on the device (works fully offline).
 * Silent by default; only plays after the user picks a sound.
 * A compressor + makeup gain keeps sounds clearly audible on phone speakers.
 */
type SoundId = "rain" | "lightrain" | "forest" | "library" | "fire" | "stream";

const SOUNDS: { id: SoundId; label: string; emoji: string }[] = [
  { id: "rain", label: "Rain", emoji: "🌧️" },
  { id: "lightrain", label: "Light rain", emoji: "🌦️" },
  { id: "forest", label: "Forest", emoji: "🌲" },
  { id: "library", label: "White noise", emoji: "📖" },
  { id: "fire", label: "Campfire", emoji: "🔥" },
  { id: "stream", label: "Stream", emoji: "🌊" },
];

function noiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown") {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w * 0.5;
      else if (kind === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

/** Real nature recordings (public domain / CC0, Wikimedia Commons), bundled in the app. */
const RECORDED: Partial<Record<SoundId, string>> = {
  rain: rainUrl,
  lightrain: rainSoftUrl,
  stream: streamUrl,
  forest: forestUrl,
};
const decoded = new Map<string, Promise<AudioBuffer>>();
function loadRecording(ctx: AudioContext, url: string) {
  let p = decoded.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("sound unavailable");
        return r.arrayBuffer();
      })
      .then((b) => ctx.decodeAudioData(b));
    p.catch(() => decoded.delete(url));
    decoded.set(url, p);
  }
  return p;
}

/** Plays a real recording on a seamless loop; falls back to the generated sound if it can't load. */
function buildRecorded(ctx: AudioContext, id: SoundId, url: string, out: AudioNode): () => void {
  let stopped = false;
  let stopInner: () => void = () => {};
  loadRecording(ctx, url)
    .then((buf) => {
      if (stopped) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g).connect(out);
      src.start();
      stopInner = () => {
        try { src.stop(); } catch { /* already stopped */ }
      };
    })
    .catch(() => {
      if (!stopped) stopInner = build(ctx, id === "lightrain" ? "rain" : id, out);
    });
  return () => {
    stopped = true;
    stopInner();
  };
}

type Engine = { ctx: AudioContext; master: GainNode; stop: () => void };

function build(ctx: AudioContext, id: SoundId, out: AudioNode): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const loop = (kind: "white" | "pink" | "brown") => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, kind);
    s.loop = true;
    nodes.push(s);
    return s;
  };
  const filt = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const gain = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };

  if (id === "library") {
    const s = loop("pink");
    s.connect(filt("lowpass", 6000)).connect(gain(1)).connect(out);
  } else if (id === "rain") {
    const s = loop("pink");
    s.connect(filt("highpass", 400)).connect(filt("lowpass", 7000)).connect(gain(1.1)).connect(out);
    const low = loop("brown");
    low.connect(filt("lowpass", 500)).connect(gain(0.6)).connect(out);
  } else if (id === "stream") {
    const s = loop("brown");
    const bp = filt("bandpass", 900, 0.6);
    const g = gain(1.2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.25;
    const lfoG = gain(350);
    lfo.connect(lfoG).connect(bp.frequency);
    nodes.push(lfo);
    s.connect(bp).connect(g).connect(out);
    const hiss = loop("pink");
    hiss.connect(filt("highpass", 2500)).connect(gain(0.25)).connect(out);
  } else if (id === "fire") {
    const s = loop("brown");
    s.connect(filt("lowpass", 900)).connect(gain(1.1)).connect(out);
    const crackle = () => {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      src.buffer = b;
      const g = gain(0.4 + Math.random() * 0.6);
      src.connect(filt("highpass", 1500 + Math.random() * 2500)).connect(g).connect(out);
      src.start(t);
      timers.push(window.setTimeout(crackle, 40 + Math.random() * 260));
    };
    crackle();
  } else if (id === "forest") {
    const s = loop("pink");
    s.connect(filt("bandpass", 600, 0.4)).connect(gain(0.7)).connect(out);
    const chirp = () => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = gain(0);
      const base = 2500 + Math.random() * 2000;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      const repeat = Math.random() < 0.5;
      timers.push(window.setTimeout(chirp, repeat ? 180 : 1500 + Math.random() * 4000));
    };
    timers.push(window.setTimeout(chirp, 800));
  }
  nodes.forEach((n) => n.start());
  return () => {
    timers.forEach((t) => clearTimeout(t));
    nodes.forEach((n) => {
      try { n.stop(); } catch { /* already stopped */ }
    });
  };
}

export function SessionSoundscape({ paused }: { paused: boolean }) {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState<SoundId | null>(null);
  const [volume, setVolume] = useState(0.8);
  const engine = useRef<Engine | null>(null);

  const ensureCtx = () => {
    if (engine.current) return engine.current;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    // makeup gain so phone speakers at full volume are clearly audible
    master.gain.value = volume * 2.2;
    master.connect(comp).connect(ctx.destination);
    engine.current = { ctx, master, stop: () => {} };
    return engine.current;
  };

  const choose = (id: SoundId | null) => {
    const e = id ? ensureCtx() : engine.current;
    e?.stop();
    if (e) e.stop = () => {};
    setSound(id);
    if (id && e) {
      void e.ctx.resume();
      const url = RECORDED[id];
      e.stop = url ? buildRecorded(e.ctx, id, url, e.master) : build(e.ctx, id, e.master);
    }
  };

  useEffect(() => {
    const e = engine.current;
    if (e) e.master.gain.setTargetAtTime(volume * 2.2, e.ctx.currentTime, 0.05);
  }, [volume]);

  useEffect(() => {
    const e = engine.current;
    if (!e || !sound) return;
    if (paused) void e.ctx.suspend();
    else void e.ctx.resume();
  }, [paused, sound]);

  useEffect(
    () => () => {
      engine.current?.stop();
      void engine.current?.ctx.close();
      engine.current = null;
    },
    [],
  );

  const current = SOUNDS.find((s) => s.id === sound);

  return (
    <>
      <button
        type="button"
        aria-label="Focus sounds"
        onClick={() => setOpen(true)}
        className="absolute left-4 top-[max(40px,calc(env(safe-area-inset-top,0px)+16px))] z-20 flex h-10 items-center gap-1.5 rounded-full bg-foreground/10 px-3 text-xs font-medium text-foreground shadow-soft backdrop-blur transition-transform active:scale-95"
      >
        {current ? <span>{current.emoji}</span> : <Headphones className="h-4 w-4" />}
        <span>{current ? current.label : "Sounds"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 px-4 pb-5 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm animate-scale-in rounded-3xl border border-hairline bg-popover p-5 text-popover-foreground shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold">Focus sounds</p>
              <button aria-label="Close" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-foreground/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Optional · works offline · stops when the session ends</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => choose(null)}
                className={`rounded-2xl border px-2 py-3 text-xs font-medium ${!sound ? "border-primary bg-primary/15 text-primary" : "border-hairline bg-background"}`}
              >
                <VolumeX className="mx-auto mb-1 h-5 w-5" />
                Silent
              </button>
              {SOUNDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose(s.id)}
                  className={`rounded-2xl border px-2 py-3 text-xs font-medium ${sound === s.id ? "border-primary bg-primary/15 text-primary" : "border-hairline bg-background"}`}
                >
                  <span className="mb-1 block text-xl">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Sound volume"
                className="w-full accent-primary"
              />
            </div>
            {paused && sound && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">Paused during your break</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
