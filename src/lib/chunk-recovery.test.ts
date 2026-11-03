import { describe, expect, test } from "bun:test";
import { isChunkLoadError, nextBridgeReload } from "./chunk-recovery";

describe("stalled page recovery", () => {
  test("recognises failed page-code downloads", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /assets/x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
  test("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("missing phone connection recovery", () => {
  test("allows at most two reloads per minute", () => {
    const now = 100_000;
    expect(nextBridgeReload([], now)).toEqual([now]);
    expect(nextBridgeReload([now - 5_000], now)).toEqual([now - 5_000, now]);
    expect(nextBridgeReload([now - 5_000, now - 2_000], now)).toBeNull();
  });
  test("old attempts expire after a minute", () => {
    const now = 200_000;
    expect(nextBridgeReload([now - 70_000, now - 65_000], now)).toEqual([now]);
  });
});
