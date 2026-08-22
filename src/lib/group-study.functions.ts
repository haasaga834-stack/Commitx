import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_GROUP_SIZE,
  type GroupDTO,
  type GroupMemberDTO,
  type GroupStateDTO,
  type InvitePreviewDTO,
} from "./group-study.shared";

interface InvitePreviewRow {
  id: string;
  goal: string;
  duration_minutes: number;
  commit_value: number;
  mode: "standard" | "verified";
  status: string;
  creator_name: string;
  member_count: number | string;
}

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("create_study_group", {
      _user_id: context.userId,
      _goal: data.goal,
      _duration: data.duration,
      _value: data.value,
      _mode: data.mode,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row) throw new Error(error?.message || "Could not create the group.");
    return { id: row.id as string, code: row.code as string };
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
    const row = (rows as InvitePreviewRow[] | null)?.[0];
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("join_study_group", {
      _user_id: context.userId,
      _code: data.code.toUpperCase(),
    });
    if (error || !id) throw new Error(error?.message || "Could not join this group.");
    return { id: id as string };
  });

/** Everything a participant needs, including the authoritative server clock. */
export const getGroupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<GroupStateDTO> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("settle_expired_study_group", {
      _user_id: userId,
      _group_id: data.id,
    });
    const { data: group, error } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !group) throw new Error("Group not found.");

    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, display_name, role, status, joined_at")
      .eq("group_id", data.id)
      .order("created_at", { ascending: true });

    const list = (members ?? []) as GroupMemberDTO[];

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("start_study_group", {
      _user_id: context.userId,
      _group_id: data.id,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row) throw new Error(error?.message || "Could not start the session.");
    return { started_at: row.started_at as string, ends_at: row.ends_at as string };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("settle_study_group_member", {
      _user_id: context.userId,
      _group_id: data.id,
      _status: data.status,
    });
    if (error) throw new Error(error.message || "Could not record your outcome.");
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
    const ids = (memberships ?? []).map((membership) => membership.group_id);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("cancel_study_group", {
      _user_id: context.userId,
      _group_id: data.id,
    });
    if (error) throw new Error(error.message || "Could not cancel the group.");
    return { ok: true };
  });
