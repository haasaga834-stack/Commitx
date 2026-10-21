import { describe, expect, test } from "bun:test";
import { shareInvite } from "./share-invite";

describe("Study Buddy sharing", () => {
  test("native sharing receives the invite without opening a WebView link", async () => {
    const calls: string[] = [];
    expect(await shareInvite("Buddy", "Code ABC123", "https://commitx.site/buddy/ABC123", {
      nativeShare: (title, text) => calls.push(`${title}|${text}`),
      webShare: async () => { throw new Error("Native should take precedence"); },
    })).toBe("shared");
    expect(calls).toEqual(["Buddy|Code ABC123\nhttps://commitx.site/buddy/ABC123"]);
  });
  test("old Android builds can copy the invite instead of opening WhatsApp in a popup", async () => {
    let copied = "";
    expect(await shareInvite("Buddy", "Code ABC123", "https://commitx.site/buddy/ABC123", {
      copy: async text => { copied = text; },
    })).toBe("copied");
    expect(copied).toBe("Code ABC123\nhttps://commitx.site/buddy/ABC123");
  });
  test("website uses the supported sharing menu", async () => {
    let sent: ShareData | undefined;
    expect(await shareInvite("Buddy", "Code ABC123", "https://commitx.site/buddy/ABC123", {
      webShare: async data => { sent = data; },
    })).toBe("shared");
    expect(sent?.url).toBe("https://commitx.site/buddy/ABC123");
  });
  test("cancelling does not copy or open another app", async () => {
    expect(await shareInvite("Buddy", "Code ABC123", "https://commitx.site/buddy/ABC123", {
      webShare: async () => { throw new DOMException("Cancelled", "AbortError"); },
      copy: async () => { throw new Error("Should not copy on cancellation"); },
    })).toBe("cancelled");
  });
  test("permission failures fall back to copying", async () => {
    let copied = false;
    expect(await shareInvite("Buddy", "Code ABC123", "https://commitx.site/buddy/ABC123", {
      webShare: async () => { throw new Error("Not allowed"); },
      copy: async () => { copied = true; },
    })).toBe("copied");
    expect(copied).toBe(true);
  });
});