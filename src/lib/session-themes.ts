/* Session ambience themes. Purely visual: they never change session rules. */

export type SessionThemeId = "leaves" | "fireflies" | "tree" | "moon" | "lotus";

export interface SessionTheme {
  id: SessionThemeId;
  emoji: string;
  name: string;
  tagline: string;
  /** Short description shown on the selector card. */
  detail: string;
}

export const SESSION_THEMES: readonly SessionTheme[] = [
  {
    id: "leaves",
    emoji: "🍂",
    name: "Falling Leaves",
    tagline: "Let your thoughts flow gently.",
    detail: "Seasonal leaves drifting on a soft breeze.",
  },
  {
    id: "fireflies",
    emoji: "✨",
    name: "Firefly Garden",
    tagline: "Stay focused, one quiet moment at a time.",
    detail: "A dark, peaceful garden lit by slow fireflies.",
  },
  {
    id: "tree",
    emoji: "🌱",
    name: "Growing Tree",
    tagline: "Every focused minute helps you grow.",
    detail: "A minimal tree that grows with your progress.",
  },
  {
    id: "moon",
    emoji: "🌙",
    name: "Moonlit Sky",
    tagline: "Slow down. Stay present. Keep going.",
    detail: "Soft moon, quiet stars, very slow clouds.",
  },
  {
    id: "lotus",
    emoji: "🪷",
    name: "Lotus Pond",
    tagline: "Breathe deeply and find your calm.",
    detail: "Still water, subtle ripples, an opening lotus.",
  },
];

export const DEFAULT_SESSION_THEME: SessionThemeId = "leaves";

export function isSessionThemeId(value: unknown): value is SessionThemeId {
  return SESSION_THEMES.some((t) => t.id === value);
}

export function normalizeTheme(value: unknown): SessionThemeId {
  return isSessionThemeId(value) ? value : DEFAULT_SESSION_THEME;
}

export function themeById(id: unknown): SessionTheme {
  const key = normalizeTheme(id);
  return SESSION_THEMES.find((t) => t.id === key)!;
}

const LAST_THEME_KEY = "commitx-session-theme-v1";

/** Last theme the user picked — only a convenience default for the picker. */
export function readLastTheme(): SessionThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_THEME_KEY);
    return isSessionThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function rememberTheme(id: SessionThemeId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_THEME_KEY, id);
  } catch {}
}
