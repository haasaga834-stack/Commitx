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
  expect(defaultShieldPackages([{ pkg: "example.notes", defaultBlocked: false }]))
    .toEqual([]);
});
test("Telegram and Telegram X remain optional even with social category metadata", () => {
  expect(defaultShieldPackages([
    { pkg: "org.telegram.messenger", defaultBlocked: true },
    { pkg: "org.telegram.messenger.web", defaultBlocked: true },
    { pkg: "org.thunderdog.challegram", defaultBlocked: true },
  ])).toEqual([]);
});
test("Chrome and Edge are required defaults on older bridges", () => {
  expect(defaultShieldPackages([{ pkg: "com.android.chrome" }, { pkg: "com.microsoft.emmx" }]))
    .toEqual(["com.android.chrome", "com.microsoft.emmx"]);
});
test("other known browsers and Android-detected URL handlers are required defaults", () => {
  expect(defaultShieldPackages([
    { pkg: "org.mozilla.firefox" }, { pkg: "com.brave.browser" },
    { pkg: "com.sec.android.app.sbrowser" }, { pkg: "example.browser", defaultBlocked: true },
  ])).toEqual(["org.mozilla.firefox", "com.brave.browser", "com.sec.android.app.sbrowser", "example.browser"]);
});
test("Verified requires supported blocking, both permissions and a selection", () => {
  const selected = ["com.instagram.android"];
  expect(canConfirmShield(true, true, true, selected)).toBe(true);
  expect(canConfirmShield(false, true, true, selected)).toBe(false);
  expect(canConfirmShield(true, false, true, selected)).toBe(false);
  expect(canConfirmShield(true, true, false, selected)).toBe(false);
  expect(canConfirmShield(true, true, true, [])).toBe(false);
});