import { describe, expect, test } from "bun:test";
import { WIDGET_QUICK_MINUTES, quickStartShieldPackages } from "./focus-shield-defaults";

describe("widget quick start", () => {
  test("is fixed to 30 minutes", () => {
    expect(WIDGET_QUICK_MINUTES).toBe(30);
  });
  test("blocks the Verified default apps only", () => {
    const pkgs = quickStartShieldPackages([
      { pkg: "com.instagram.android" },
      { pkg: "com.example.notes", defaultBlocked: false },
      { pkg: "com.custom.game", defaultBlocked: true },
    ]);
    expect(pkgs).toEqual(["com.instagram.android", "com.custom.game"]);
  });
});
