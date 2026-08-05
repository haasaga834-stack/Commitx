export type ThemeMode = "light" | "dark";

export const THEME_KEY = "commitx-theme-v1";

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#141a17" : "#F8F9F6");
}

export function setTheme(mode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {}
  applyTheme(mode);
  // Persist the choice with the user's cloud settings so it follows the account.
  void import("./planner").then((m) => m.syncThemeToCloud(mode));
  window.dispatchEvent(new CustomEvent("commitx:theme-change", { detail: mode }));
}

// eslint-disable-next-line import/first
import { useEffect, useState } from "react";

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("light");
  useEffect(() => {
    const current = readTheme();
    setMode(current);
    applyTheme(current);
    const onChange = (e: Event) => setMode(((e as CustomEvent).detail as ThemeMode) ?? readTheme());
    window.addEventListener("commitx:theme-change", onChange);
    return () => window.removeEventListener("commitx:theme-change", onChange);
  }, []);
  return { mode, setMode: setTheme, isDark: mode === "dark" };
}
