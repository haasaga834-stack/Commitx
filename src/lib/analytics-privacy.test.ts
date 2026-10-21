import { expect, test } from "bun:test";
import { safeAnalyticsProps, redactAnalyticsEvent } from "./analytics-privacy";

test("analytics excludes study content and identity properties", () => {
  expect(safeAnalyticsProps({ goal: "private study topic", email: "student@example.test", mode: "standard", duration_bucket: "120m+" }))
    .toEqual({ mode: "standard", duration_bucket: "120m+" });
});
test("analytics strips session URLs and raw exceptions", () => {
  const event = { properties: { $current_url: "https://commitx.site/success?goal=private", $referrer: "https://commitx.site/auth?token=secret", $exception_message: "private topic", goal: "private", mode: "verified" } };
  expect(redactAnalyticsEvent(event)?.properties).toEqual({ $current_url: "[redacted]", $referrer: "[redacted]", mode: "verified" });
});