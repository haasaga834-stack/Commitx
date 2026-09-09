import { useState } from "react";

/**
 * Focus Garden — a lightweight SVG illustration that grows with focus minutes.
 * Presentation only; nothing here reads or writes app data.
 */
const STAGES = [
  { min: 10, label: "Seed" },
  { min: 30, label: "Sprout" },
  { min: 60, label: "Plant" },
  { min: 120, label: "Growing tree" },
];

function stageFor(minutes: number) {
  if (minutes >= 120) return 3;
  if (minutes >= 60) return 2;
  if (minutes >= 30) return 1;
  return 0;
}

export function FocusGarden() {
  const [minutes, setMinutes] = useState(60);
  const stage = stageFor(minutes);
  const growth = Math.min(1, minutes / 120);

  const trunkH = 12 + growth * 58;
  const leafScale = 0.35 + growth * 0.95;

  return (
    <div className="mx-auto max-w-3xl rounded-[28px] border border-ink-line bg-paper p-7 sm:p-10">
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 160" className="h-44 w-full max-w-xs text-ink">
          {/* sky glow */}
          <circle
            cx="158"
            cy="30"
            r="18"
            fill="oklch(0.86 0.09 88)"
            opacity={0.25 + growth * 0.35}
            className="animate-sun-breathe"
          />
          {/* ground */}
          <path d="M10 140 Q100 122 190 140 L190 152 L10 152 Z" fill="oklch(0.88 0.03 90)" />

          {/* seed */}
          {stage === 0 ? (
            <ellipse cx="100" cy="136" rx="6" ry="4.5" fill="oklch(0.5 0.06 60)" />
          ) : null}

          {/* stem / trunk */}
          {stage > 0 ? (
            <g className="animate-canopy-sway" style={{ transformOrigin: "100px 138px" }}>
              <path
                d={`M100 138 C ${100 - growth * 6} ${138 - trunkH / 2}, ${100 + growth * 6} ${138 - trunkH * 0.75}, 100 ${138 - trunkH}`}
                stroke="oklch(0.45 0.06 60)"
                strokeWidth={2 + growth * 4}
                strokeLinecap="round"
                fill="none"
                style={{ transition: "all 400ms ease-out" }}
              />
              <g
                transform={`translate(100 ${138 - trunkH}) scale(${leafScale})`}
                style={{ transition: "all 400ms ease-out" }}
              >
                <ellipse cx="-16" cy="2" rx="16" ry="11" fill="oklch(0.55 0.1 148)" opacity="0.9" />
                <ellipse cx="16" cy="0" rx="17" ry="12" fill="oklch(0.5 0.1 150)" opacity="0.9" />
                <ellipse cx="0" cy="-12" rx="19" ry="13" fill="oklch(0.58 0.1 145)" opacity="0.95" />
              </g>
            </g>
          ) : null}

          {/* drifting motes */}
          {stage > 1
            ? [0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={70 + i * 30}
                  cy={110 - i * 8}
                  r="1.8"
                  fill="oklch(0.76 0.115 78)"
                  className="animate-particle-glow"
                  style={{ animationDelay: `${i * 0.8}s` }}
                />
              ))
            : null}
        </svg>

        <p className="mt-6 text-sm font-medium">{STAGES[stage]!.label}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {minutes} minutes of focus
        </p>

        <input
          type="range"
          min={10}
          max={150}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="Focus minutes"
          className="mt-7 h-1.5 w-full max-w-sm cursor-pointer appearance-none rounded-full bg-ink-line accent-[oklch(0.44_0.085_148)]"
        />
        <div className="mt-3 flex w-full max-w-sm justify-between text-[11px] text-ink-soft/80">
          {STAGES.map((s, i) => (
            <span key={s.label} className={i === stage ? "text-ink" : undefined}>
              {s.min >= 60 ? `${s.min / 60}h` : `${s.min}m`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
