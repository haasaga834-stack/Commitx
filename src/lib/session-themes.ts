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
    tagline: "Let thoughts flow gently.",
    detail: "Let thoughts flow gently.",
  },
  {
    id: "fireflies",
    emoji: "✨",
    name: "Firefly Garden",
    tagline: "Quiet light, deep focus.",
    detail: "Quiet light, deep focus.",
  },
  {
    id: "tree",
    emoji: "🌱",
    name: "Growing Plant",
    tagline: "Watch your focus grow.",
    detail: "Watch your focus grow.",
  },
  {
    id: "moon",
    emoji: "🌙",
    name: "Moonlit Sky",
    tagline: "Slow down, stay present.",
    detail: "Slow down, stay present.",
  },
  {
    id: "lotus",
    emoji: "🪷",
    name: "Lotus Pond",
    tagline: "Breathe and find calm.",
    detail: "Breathe and find calm.",
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
