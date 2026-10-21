type ShareResult = "shared" | "copied" | "cancelled" | "unavailable";

interface ShareTools {
  nativeShare?: (title: string, text: string) => void;
  webShare?: (data: ShareData) => Promise<void>;
  copy?: (text: string) => Promise<void>;
}

/** Never navigate the WebView to a messaging app's unsupported URL scheme. */
export async function shareInvite(title: string, text: string, url: string, tools: ShareTools): Promise<ShareResult> {
  if (tools.nativeShare) {
    try {
      tools.nativeShare(title, `${text}\n${url}`);
      return "shared";
    } catch { /* Older/unavailable native implementation: keep the invite usable. */ }
  }
  if (tools.webShare) {
    try {
      await tools.webShare({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (tools.copy) {
      await tools.copy(`${text}\n${url}`);
      return "copied";
    }
  } catch {}
  return "unavailable";
}