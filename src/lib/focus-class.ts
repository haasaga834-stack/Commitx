import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FocusClassSound =
  | "rain"
  | "forest"
  | "ocean"
  | "campfire"
  | "deep-focus"
  | "silence";

export interface FocusClassPresenceSnapshot {
  count: number;
  loading: boolean;
}

const HEARTBEAT_MS = 15_000;
const FOCUS_CLASS_KEY = "commitx-focus-class-presence-v1";

function safeCount(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

export function getFocusClassPresenceKey() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(FOCUS_CLASS_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(FOCUS_CLASS_KEY, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export async function fetchFocusClassCount() {
  const { data, error } = await supabase.rpc("focus_class_active_count");
  if (error) throw error;
  return safeCount(data);
}

export async function touchFocusClassPresence(
  presenceKey: string,
  durationMinutes: number,
  sound: FocusClassSound,
) {
  const { data, error } = await supabase.rpc("focus_class_touch", {
    _presence_key: presenceKey,
    _duration_minutes: durationMinutes,
    _sound: sound,
  });
  if (error) throw error;
  return safeCount(data);
}

export async function leaveFocusClassPresence(presenceKey: string) {
  const { data, error } = await supabase.rpc("focus_class_leave", {
    _presence_key: presenceKey,
  });
  if (error) throw error;
  return safeCount(data);
}

export async function completeFocusClassPresence(presenceKey: string) {
  const { data, error } = await supabase.rpc("focus_class_complete", {
    _presence_key: presenceKey,
  });
  if (error) throw error;
  return safeCount(data);
}

export function useFocusClassCount(): FocusClassPresenceSnapshot {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchFocusClassCount();
      setCount(next);
    } catch {
      // Keep the last real value rather than inventing a fallback.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const next = await fetchFocusClassCount();
        if (!cancelled) setCount(next);
      } catch {
        // Leave the current count untouched on temporary network issues.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const interval = window.setInterval(run, 20_000);
    const channel = supabase
      .channel(`focus-class-count-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "focus_class_presence" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return useMemo(() => ({ count, loading }), [count, loading]);
}

type NoiseStop = () => void;

function createNoise(ctx: AudioContext, filterType: BiquadFilterType, frequency: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  src.connect(filter);
  src.start();
  return { src, filter };
}

function makeSound(ctx: AudioContext, kind: FocusClassSound): NoiseStop {
  if (kind === "silence") return () => {};

  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.connect(ctx.destination);
  out.gain.setTargetAtTime(0.18, ctx.currentTime + 0.02, 0.8);

  const stops: NoiseStop[] = [() => out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)];

  if (kind === "rain") {
    const rain = createNoise(ctx, "highpass", 1200);
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    rain.filter.connect(gain).connect(out);
    stops.push(() => rain.src.stop());
  }

  if (kind === "forest") {
    const wind = createNoise(ctx, "lowpass", 640);
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    wind.filter.connect(gain).connect(out);
    const osc = ctx.createOscillator();
    const chirp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1450;
    chirp.gain.value = 0.012;
    osc.connect(chirp).connect(out);
    osc.start();
    stops.push(() => wind.src.stop(), () => osc.stop());
  }

  if (kind === "ocean") {
    const ocean = createNoise(ctx, "lowpass", 520);
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    gain.gain.value = 0.12;
    lfo.frequency.value = 0.075;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(gain.gain);
    ocean.filter.connect(gain).connect(out);
    lfo.start();
    stops.push(() => ocean.src.stop(), () => lfo.stop());
  }

  if (kind === "campfire") {
    const fire = createNoise(ctx, "bandpass", 900);
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    fire.filter.Q.value = 0.8;
    fire.filter.connect(gain).connect(out);
    stops.push(() => fire.src.stop());
  }

  if (kind === "deep-focus") {
    [110, 165, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      gain.gain.value = i === 0 ? 0.055 : 0.025;
      osc.connect(gain).connect(out);
      osc.start();
      stops.push(() => osc.stop());
    });
  }

  return () => {
    stops.forEach((stop) => {
      try {
        stop();
      } catch {}
    });
    window.setTimeout(() => {
      try {
        out.disconnect();
      } catch {}
    }, 450);
  };
}

export function useFocusClassAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<NoiseStop>(() => {});
  const previewTimerRef = useRef<number | null>(null);

  const ensureContext = useCallback(async () => {
    if (!ctxRef.current) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) throw new Error("Audio is not available in this browser.");
      ctxRef.current = new AudioCtor();
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const stop = useCallback(() => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    stopRef.current();
    stopRef.current = () => {};
  }, []);

  const play = useCallback(
    async (kind: FocusClassSound) => {
      stop();
      if (kind === "silence") return;
      const ctx = await ensureContext();
      stopRef.current = makeSound(ctx, kind);
    },
    [ensureContext, stop],
  );

  const preview = useCallback(
    async (kind: FocusClassSound) => {
      await play(kind);
      previewTimerRef.current = window.setTimeout(stop, 4_000);
    },
    [play, stop],
  );

  useEffect(() => stop, [stop]);

  return { play, preview, stop };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export { HEARTBEAT_MS };