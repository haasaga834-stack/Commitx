import { describe, expect, test } from "bun:test";
import { durationBucket } from "./analytics";

describe("session duration buckets", () => {
  test("a 2-hour session lands in 120m+", () => expect(durationBucket(120)).toBe("120m+"));
  test("a 60-minute session lands in 60-89m", () => expect(durationBucket(60)).toBe("60-89m"));
  test("a 25-minute session lands in <30m", () => expect(durationBucket(25)).toBe("<30m"));
});
