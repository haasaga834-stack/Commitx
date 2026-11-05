import { describe, expect, test } from "bun:test";
import { codeFromInstallReferrer, playStoreReferralUrl, referralLink, referralShareMessage } from "./referral-link";
import { REFERRAL_REWARD, REFERRER_REWARD, WELCOME_COINS } from "./commitx-store";

describe("referral rules", () => {
  test("new user with a referral gets 400 in total", () => expect(WELCOME_COINS + REFERRAL_REWARD).toBe(400));
  test("referrer earns 50", () => expect(REFERRER_REWARD).toBe(50));
  test("share message links straight to Google Play with the user's code", () => {
    const msg = referralShareMessage("CX123ABC");
    expect(msg).toContain(playStoreReferralUrl("CX123ABC"));
    expect(msg).not.toContain("commitx.site");
    expect(referralLink("CX123ABC")).toBe("https://commitx.site/r/CX123ABC");
  });
  test("play link carries the code through install", () =>
    expect(codeFromInstallReferrer(new URL(playStoreReferralUrl("CX123ABC")).searchParams.get("referrer"))).toBe("CX123ABC"));
  test("organic installs have no code", () =>
    expect(codeFromInstallReferrer("utm_source=google-play&utm_medium=organic")).toBeNull());
});
