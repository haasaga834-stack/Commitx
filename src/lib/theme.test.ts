import { afterEach, expect, test } from "bun:test";
import { readTheme } from "./theme";

const originalWindow = globalThis.window;
afterEach(() => {
  if (originalWindow) Object.assign(globalThis, { window: originalWindow });
  else Reflect.deleteProperty(globalThis, "window");
});
function preference(saved: string | null, systemDark: boolean) {
  Object.assign(globalThis, { window: {
    localStorage: { getItem: () => saved },
    matchMedia: () => ({ matches: systemDark }),
  } });
}
test("phone Home follows the OS dark preference when no theme is saved", () => {
  preference(null, true);
  expect(readTheme(true)).toBe("dark");
  preference(null, false);
  expect(readTheme(true)).toBe("light");
});
test("the saved Settings theme takes priority over the OS preference", () => {
  preference("light", true);
  expect(readTheme(true)).toBe("light");
  preference("dark", false);
  expect(readTheme(true)).toBe("dark");
});
test("other screens retain their existing unsaved light default", () => {
  preference(null, true);
  expect(readTheme()).toBe("light");
});