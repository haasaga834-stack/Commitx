import { test } from "node:test";
import assert from "node:assert/strict";
import { canCancelBeforeFocus } from "./verified-mode";

test("a Verified session blocked by DND before focus starts can be cancelled", () => {
  assert.equal(canCancelBeforeFocus(0), true);
  assert.equal(canCancelBeforeFocus(59_000), true);
});

test("a Verified session that already banked a minute of focus cannot be cancelled from the DND screen", () => {
  assert.equal(canCancelBeforeFocus(60_000), false);
  assert.equal(canCancelBeforeFocus(25 * 60_000), false);
});
