import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_GROUP_SIZE,
  makeGroupCode,
  displayNameFor,
  type GroupDTO,
  type GroupMemberDTO,
  type GroupStateDTO,
  type InvitePreviewDTO,
} from "./group-study.shared";

/** Creator sets the terms and is committed immediately. */
export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        goal: z.string().trim().min(1).max(40).default("Group Study"),
        duration: z.number().int().min(10).max(360),
        value: z.number().int().min(50).max(500),
        mode: z.enum(["standard", "verified"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string; code: string }> => {
    const { supabase, userId } = context;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("demo_balance, real_balance")
      .eq("user_id", userId)
      .maybeSingle();
    // No wallet row yet means the cloud mirror hasn't synced; local guards apply.
    if (wallet) {
      const balance = (wallet.demo_balance ?? 0) + (wallet.real_balance ?? 0);
      if (balance < data.value) throw new Error("Not enough demo money for this commitment.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeGroupCode();
      const { data: row, error } = await supabaseAdmin
        .from("study_groups")
        .insert({
          creator_id: userId,
          code,
          goal: data.goal,
          duration_minutes: data.duration,
          commit_value: data.value,
          mode: data.mode,
          status: "lobby",
        })
        .select("id, code")
        .single();
      if (!error && row) {
        await supabaseAdmin.from("group_members").insert({
          group_id: row.id,
          user_id: userId,
          display_name: await displayNameFor(supabase, userId),
          role: "creator",
          status: "committed",
          accepted_at: new Date().toISOString(),
        });
        return { id: row.id as string, code: row.code as string };
      }
      lastError = error;
    }
    throw new Error(lastError ? "Could not create the group. Please try again." : "Unknown error");
  });

/** Terms a friend sees before accepting — read through a trusted server path. */
export const previewInvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(12) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<InvitePreviewDTO> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("group_invite_preview", {
      _code: data.code.toUpperCase(),
    });
    const row = (rows as any[] | null)?.[0];
    if (error || !row) throw new Error("That invite code doesn't exist.");

    const { data: mine } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("group_id", row.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      id: row.id,
      goal: row.goal,
      duration_minutes: row.duration_minutes,
      commit_value: row.commit_value,
      mode: row.mode,
      status: row.status,
      creator_name: row.creator_name,
      member_count: Number(row.member_count) || 0,
      full: (Number(row.member_count) || 0) >= MAX_GROUP_SIZE,
      already_member: !!mine,
    };
  });

/** Accept the terms + commit the same amount. No join without both. */
export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(4).max(12),
        acceptedTerms: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin.rpc("group_invite_preview", {
      _code: data.code.toUpperCase(),
    });
    const row = (rows as any[] | null)?.[0];
    if (!row) throw new Error("That invite code doesn't exist.");
    if (row.status !== "lobby") throw new Error("This group has already started.");
    if ((Number(row.member_count) || 0) >= MAX_GROUP_SIZE) throw new Error("This group is full.");

    const { data: existing } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("group_id", row.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { id: row.id };

    const { data: wallet } = await supabase
      .from("wallets")
      .select("demo_balance, real_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (wallet) {
      const balance = (wallet.demo_balance ?? 0) + (wallet.real_balance ?? 0);
      if (balance < row.commit_value) {
        throw new Error("You need at least ₹" + row.commit_value + " to commit to this group.");
      }
    }

    const { error } = await supabaseAdmin.from("group_members").insert({
      group_id: row.id,
      user_id: userId,
      display_name: await displayNameFor(supabase, userId),
      role: "member",
      status: "committed",
      accepted_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not join this group. Please try again.");
    return { id: row.id };
  });

/** Everything a participant needs, including the authoritative server clock. */
export const getGroupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<GroupStateDTO> => {
    const { supabase, userId } = context;
    const { data: group, error } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !group) throw new Error("Group not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, display_name, role, status, joined_at")
      .eq("group_id", data.id)
      .order("created_at", { ascending: true });

    const list = (members ?? []) as GroupMemberDTO[];

    // Auto-close the group once the shared clock has run out.
    if (group.status === "active" && group.ends_at && Date.parse(group.ends_at) <= Date.now()) {
      await supabaseAdmin.from("study_groups").update({ status: "ended" }).eq("id", data.id);
      group.status = "ended";
    }

    return {
      group: group as GroupDTO,
      members: list,
      serverNow: Date.now(),
      isCreator: group.creator_id === userId,
      me: list.find((m) => m.user_id === userId) ?? null,
    };
  });

/**
 * Creator starts the shared timer for everyone.
 * Idempotent: a second tap returns the already-running window instead of
 * creating a conflicting one, and at least one other member must have joined.
 */
export const startGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ started_at: string; ends_at: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: group } = await supabaseAdmin
      .from("study_groups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!group) throw new Error("Group not found.");
    if (group.creator_id !== userId) throw new Error("Only the creator can start the session.");
    if (group.status === "active" && group.started_at && group.ends_at) {
      return { started_at: group.started_at, ends_at: group.ends_at };
    }
    if (group.status === "ended") throw new Error("This group session has already finished.");

    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, status")
      .eq("group_id", data.id);
    const present = (members ?? []).filter((m: any) => m.status !== "left");
    if (present.length < 2) {
      throw new Error("Wait for at least one friend to join before starting.");
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + group.duration_minutes * 60_000);

    // Conditional update — only the first tap flips the lobby to active.
    const { data: updated, error } = await supabaseAdmin
      .from("study_groups")
      .update({
        status: "active",
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "lobby")
      .select("started_at, ends_at")
      .maybeSingle();
    if (error) throw new Error("Could not start the session.");

    if (!updated) {
      // Someone else (a double tap) already started it — reuse that window.
      const { data: current } = await supabaseAdmin
        .from("study_groups")
        .select("status, started_at, ends_at")
        .eq("id", data.id)
        .maybeSingle();
      if (current?.status === "active" && current.started_at && current.ends_at) {
        return { started_at: current.started_at, ends_at: current.ends_at };
      }
      throw new Error("Could not start the session.");
    }

    await supabaseAdmin
      .from("group_members")
      .update({ status: "joined", joined_at: startedAt.toISOString() })
      .eq("group_id", data.id)
      .eq("status", "committed");

    return {
      started_at: updated.started_at as string,
      ends_at: updated.ends_at as string,
    };
  });

/** Record this participant's outcome (left early, failed, or finished). */
export const setMyGroupOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["completed", "failed", "left"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("group_members")
      .update({
        status: data.status,
        ...(data.status === "completed" ? {} : { left_at: new Date().toISOString() }),
      })
      .eq("group_id", data.id)
      .eq("user_id", userId);
    return { ok: true };
  });

/** Groups this user belongs to that are still open or running. */
export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GroupDTO[]> => {
    const { supabase, userId } = context;
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const ids = (memberships ?? []).map((m: any) => m.group_id as string);
    if (ids.length === 0) return [];
    const { data: groups } = await supabase
      .from("study_groups")
      .select("*")
      .in("id", ids)
      .neq("status", "ended")
      .order("created_at", { ascending: false });
    return (groups ?? []) as GroupDTO[];
  });

/** Creator cancels a group that hasn't started. */
export const cancelGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await supabase
      .from("study_groups")
      .delete()
      .eq("id", data.id)
      .eq("creator_id", userId)
      .eq("status", "lobby");
    return { ok: true };
  });
