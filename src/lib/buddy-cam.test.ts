import { describe, expect, it } from "bun:test";
import { buddyCamRoom, isCaller } from "./buddy-cam";

describe("buddy cam pairing", () => {
  it("both buddies land in the same private room", async () => {
    expect(await buddyCamRoom("a-1", "b-2")).toBe(await buddyCamRoom("b-2", "a-1"));
  });
  it("a different pair gets a different room", async () => {
    expect(await buddyCamRoom("a-1", "b-2")).not.toBe(await buddyCamRoom("a-1", "c-3"));
  });
  it("exactly one buddy places the call", () => {
    expect(isCaller("a-1", "b-2")).not.toBe(isCaller("b-2", "a-1"));
  });
});
