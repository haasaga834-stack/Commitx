import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateFocusPlan, type FocusPlan } from "./focus-plan.server";

export type { FocusPlan };

export const planFocusSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        goal: z.string().trim().min(3).max(300),
        minutes: z.number().int().min(30).max(360).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ plan: FocusPlan } | { error: string }> => {
    try {
      return { plan: await generateFocusPlan(data.goal, data.minutes) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not create a plan." };
    }
  });
