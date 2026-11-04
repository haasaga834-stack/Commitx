import { describe, expect, test } from "bun:test";
import { nativeBackParent } from "./native-back";

describe("nativeBackParent", () => {
  test("settings goes back to profile", () => expect(nativeBackParent("/settings")).toBe("/profile"));
  test("profile goes back to home", () => expect(nativeBackParent("/profile")).toBe("/"));
  test("a group room goes back to the in-app group study screen, not the marketing page", () =>
    expect(nativeBackParent("/group/abc-123")).toBe("/group"));
  test("the group-study marketing page goes back to the in-app group screen", () =>
    expect(nativeBackParent("/group-study")).toBe("/group"));
});
