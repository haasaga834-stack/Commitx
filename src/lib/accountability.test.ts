import { afterEach, expect, mock, test } from "bun:test";

mock.module("@/lib/commitx-store", () => ({ getState: () => ({ sessions: [] }) }));
const { accountabilityAppOpened, DEFAULT_ACCOUNTABILITY_STYLE } = await import("./accountability");
const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow) globalThis.window = originalWindow;
  else Reflect.deleteProperty(globalThis, "window");
});

test("built-in accountability style is Brutal", () => {
  expect(DEFAULT_ACCOUNTABILITY_STYLE).toBe("brutal");
});

test("legacy saved styles cannot override Brutal when the app opens", () => {
  for (const saved of ["gentle", "sarcastic", "savage", "off"]) {
    const styles: string[] = [];
    const opened: number[][] = [];
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
      localStorage: { getItem: () => saved },
      CommitXAndroid: {
        setAccountabilityStyle: (style: string) => styles.push(style),
        accountabilityAppOpened: (streak: number, failures: number) => opened.push([streak, failures]),
      },
    } });
    accountabilityAppOpened();
    expect(styles).toEqual(["brutal"]);
    expect(opened).toEqual([[0, 0]]);
  }
});