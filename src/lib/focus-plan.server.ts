import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export interface FocusPlan {
  title: string;
  totalMinutes: number;
  mode: "standard" | "verified";
  blocks: { minutes: number; task: string }[];
  tip: string;
}

/** Ask Lovable AI for a realistic session plan; returns parsed, clamped JSON. */
export async function generateFocusPlan(goal: string, minutes: number | null): Promise<FocusPlan> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI planning is not configured yet.");

  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      if (res.status === 402) throw new Error("AI credits are used up for now. Please try again later.");
      if (res.status === 429) throw new Error("Too many requests right now. Please wait a moment and try again.");
      return res;
    },
  });

  const system = `You plan focus sessions for CommitX, a study accountability app.
Return ONLY a JSON object, no markdown:
{"title": string (max 6 words), "totalMinutes": integer 30-360, "mode": "standard" | "verified",
 "blocks": [{"minutes": integer, "task": string (max 12 words)}] (2-6 blocks, minutes sum to totalMinutes),
 "tip": string (one short, kind, practical sentence)}
Be realistic and achievable for a student. Use "verified" only for goals needing strict no-phone focus.
Sessions over 120 minutes get an automatic 5-minute break halfway; do not add break blocks.
Every whole hour completed earns 25 Cx Coins.`;
  const user = `Goal: ${goal}\n${minutes ? `Time available: ${minutes} minutes (use exactly this).` : "Pick a sensible length."}`;

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    prompt: user,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  return parsePlan(text, goal, minutes);
}

function parsePlan(text: string, goal: string, minutes: number | null): FocusPlan {
  let raw: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    raw = m ? JSON.parse(m[0]) : {};
  } catch {
    raw = {};
  }
  const total = Math.max(30, Math.min(360, Math.round(minutes ?? (Number(raw.totalMinutes) || 60))));
  let blocks: { minutes: number; task: string }[] = Array.isArray(raw.blocks)
    ? raw.blocks
        .map((b: any) => ({
          minutes: Math.max(5, Math.round(Number(b?.minutes) || 0)),
          task: String(b?.task ?? "").slice(0, 120).trim(),
        }))
        .filter((b: { task: string }) => b.task)
        .slice(0, 6)
    : [];
  if (blocks.length === 0) blocks = [{ minutes: total, task: goal }];
  // Scale block lengths so they add up to the session length.
  const sum = blocks.reduce((a, b) => a + b.minutes, 0);
  blocks = blocks.map((b) => ({ ...b, minutes: Math.max(5, Math.round((b.minutes / sum) * total)) }));
  const diff = total - blocks.reduce((a, b) => a + b.minutes, 0);
  blocks[blocks.length - 1].minutes = Math.max(5, blocks[blocks.length - 1].minutes + diff);
  return {
    title: String(raw.title ?? goal).slice(0, 60) || goal,
    totalMinutes: total,
    mode: raw.mode === "verified" ? "verified" : "standard",
    blocks,
    tip: String(raw.tip ?? "").slice(0, 200),
  };
}
