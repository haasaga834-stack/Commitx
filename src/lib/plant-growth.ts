const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoothRamp = (progress: number, start: number, end: number) => {
  const t = clamp((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
};

/** Presentation only: growth always comes from the existing session clock. */
export function plantGrowth(progress: number) {
  const p = Number.isFinite(progress) ? clamp(progress) : 0;
  return {
    progress: p,
    seed: 1 - smoothRamp(p, 0.04, 0.16),
    stem: smoothRamp(p, 0.03, 0.72),
    flowers: smoothRamp(p, 0.65, 0.83) * (1 - smoothRamp(p, 0.86, 1)),
    fruit: smoothRamp(p, 0.84, 1),
  };
}