import { expect, test } from "bun:test";
import { HOME_QUICK_COMMIT_MINUTES } from "./home-presets";

test("Home offers the requested 30, 60 and 90 minute commitments", () => {
  expect([...HOME_QUICK_COMMIT_MINUTES]).toEqual([30, 60, 90]);
});