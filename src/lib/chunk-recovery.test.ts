import { describe, expect, test } from "bun:test";
import { isChunkLoadError } from "./chunk-recovery";

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
