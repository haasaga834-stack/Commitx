import { describe, expect, test } from "bun:test";
import { nativeBackParent } from "./native-back";

describe("nativeBackParent", () => {
  test("settings goes back to profile", () => expect(nativeBackParent("/settings")).toBe("/profile"));
  test("profile goes back to home", () => expect(nativeBackParent("/profile")).toBe("/"));
});
