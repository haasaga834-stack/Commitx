import { expect, test } from "bun:test";
import { canConfirmShield, defaultShieldPackages } from "./focus-shield-defaults";

test("social media apps are selected by default", () => {
  expect(defaultShieldPackages([{ pkg: "com.instagram.android" }, { pkg: "com.zhiliaoapp.musically" }]))
    .toEqual(["com.instagram.android", "com.zhiliaoapp.musically"]);
});
test("known and Android-classified games are selected by default", () => {
  expect(defaultShieldPackages([{ pkg: "com.roblox.client" }, { pkg: "example.new.game", defaultBlocked: true }]))
    .toEqual(["com.roblox.client", "example.new.game"]);
});
test("other apps remain optional", () => {
  expect(defaultShieldPackages([{ pkg: "com.android.chrome" }, { pkg: "example.notes", defaultBlocked: false }]))
    .toEqual([]);
});
test("Verified requires supported blocking, both permissions and a selection", () => {
  const selected = ["com.instagram.android"];
  expect(canConfirmShield(true, true, true, selected)).toBe(true);
  expect(canConfirmShield(false, true, true, selected)).toBe(false);
  expect(canConfirmShield(true, false, true, selected)).toBe(false);
  expect(canConfirmShield(true, true, false, selected)).toBe(false);
  expect(canConfirmShield(true, true, true, [])).toBe(false);
});