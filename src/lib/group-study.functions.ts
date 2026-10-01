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

/**
 * Lobby reads run over POST so no browser or proxy cache can replay a stale
 * waiting room: a cached response is exactly how a host ends up staring at an
 * empty lobby while friends have already joined.
 */

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
        theme: z.enum(["leaves", "fireflies", "tree", "moon", "lotus"]).default("leaves"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string; code: string } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("create_study_group", {
      _user_id: context.userId,
      _goal: data.goal,
      _duration: data.duration,
      _value: data.value,
      _mode: data.mode,
      _theme: data.theme,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row) return { error: error?.message || "Could not create the group." };
    return { id: row.id as string, code: row.code as string };
  });

/** Terms a friend sees before accepting — read through a trusted server path. */
export const previewInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(12) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<InvitePreviewDTO | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("group_invite_preview", {
      _code: data.code.toUpperCase(),
    });
    const row = (rows as InvitePreviewRow[] | null)?.[0];
    if (error || !row) return { error: "That invite code doesn't exist." };


    const { data: mine } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("group_id", row.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    // Late joining shares the group's one authoritative end time, so the
    // invite can show exactly how much of the session is still left.
    const { data: window } = await supabaseAdmin
      .from("study_groups")
      .select("ends_at")
      .eq("id", row.id)
      .maybeSingle();
    const endsAt = (window?.ends_at as string | null) ?? null;
    const msLeft = endsAt ? Date.parse(endsAt) - Date.now() : 0;
    const running = row.status === "active" && msLeft > 0;

    return {
      running,
      ends_at: endsAt,
      minutes_left: running ? Math.max(1, Math.round(msLeft / 60000)) : null,
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
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("join_study_group", {
      _user_id: context.userId,
      _code: data.code.toUpperCase(),
    });
    if (error || !id) return { error: error?.message || "Could not join this group." };
    return { id: id as string };
  });

/** Everything a participant needs, including the authoritative server clock. */
export const getGroupState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<GroupStateDTO | { gone: true }> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("settle_expired_study_group", {
      _user_id: userId,
      _group_id: data.id,
    });

    // Access ends immediately when a participant leaves or is settled. Check
    // current membership before any privileged member-list read.
    const { data: membership } = await supabase
      .from("group_members")
      .select("status")
      .eq("group_id", data.id)
      .eq("user_id", userId)
      .in("status", ["committed", "joined"])
      .maybeSingle();
    if (!membership) return { gone: true };

    const { data: group } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    // Cancelled / deleted groups are a normal outcome, not a crash.
    if (!group) return { gone: true };


    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, display_name, role, status, joined_at")
      .eq("group_id", data.id)
      .order("created_at", { ascending: true });

    const list = ((members ?? []) as GroupMemberDTO[]).filter(
      (member) => member.status === "committed" || member.status === "joined",
    );

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

/**
 * Groups this user is genuinely still part of: waiting in the lobby, or running
 * inside their window. Anything expired is settled first and then dropped, so
 * finished sessions never linger in the list.
 */
export const listMyGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GroupDTO[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Drop leftovers from finished / cancelled / expired sessions first, so
    // nothing stale lingers in the list or blocks a new commitment.
    await supabaseAdmin
      .rpc("release_stale_commitments", { _user_id: userId })
      .then(() => undefined, () => undefined);

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_id", userId);
    const rows = memberships ?? [];
    const openIds = rows
      .filter((m) => m.status === "committed" || m.status === "joined")
      .map((m) => m.group_id);
    if (openIds.length === 0) return [];

    // Settle anything whose window has already elapsed before reading.
    await Promise.all(
      openIds.map((id) =>
        supabaseAdmin
          .rpc("settle_expired_study_group", { _user_id: userId, _group_id: id })
          .then(() => undefined, () => undefined),
      ),
    );

    const { data: fresh } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_id", userId)
      .in("group_id", openIds);
    const stillOpen = (fresh ?? [])
      .filter((m) => m.status === "committed" || m.status === "joined")
      .map((m) => m.group_id);
    if (stillOpen.length === 0) return [];

    const { data: groups } = await supabase
      .from("study_groups")
      .select("*")
      .in("id", stillOpen)
      .in("status", ["lobby", "active"])
      .order("created_at", { ascending: false });

    const now = Date.now();
    return ((groups ?? []) as GroupDTO[]).filter(
      (g) => !g.ends_at || new Date(g.ends_at).getTime() > now,
    );
  });

/**
 * The single group this user still owes an outcome to (waiting or genuinely
 * running). Terminal records — cancelled, completed, expired, or past their
 * window — are settled first and never reported, so a stale row can't block a
 * new group.
 */
export const getMyOpenGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ id: string; code: string; status: string; isHost: boolean } | null> => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const quiet = (p: PromiseLike<unknown>) => p.then(() => undefined, () => undefined);

      await quiet(supabaseAdmin.rpc("release_stale_commitments", { _user_id: context.userId }));

      const openMemberships = async () => {
        const { data } = await supabaseAdmin
          .from("group_members")
          .select("group_id, role, settled_at, status")
          .eq("user_id", context.userId)
          .is("settled_at", null)
          .in("status", ["committed", "joined"])
          .order("created_at", { ascending: false })
          .limit(5);
        return data ?? [];
      };

      let rows = await openMemberships();
      if (rows.length === 0) return null;

      // Settle anything whose shared window has already elapsed, then re-read.
      await Promise.all(
        rows.map((m) =>
          quiet(
            supabaseAdmin.rpc("settle_expired_study_group", {
              _user_id: context.userId,
              _group_id: m.group_id,
            }),
          ),
        ),
      );
      await quiet(supabaseAdmin.rpc("release_stale_commitments", { _user_id: context.userId }));
      rows = await openMemberships();
      if (rows.length === 0) return null;

      const { data: groups } = await supabaseAdmin
        .from("study_groups")
        .select("id, code, status, creator_id, ends_at")
        .in(
          "id",
          rows.map((m) => m.group_id),
        )
        .in("status", ["lobby", "active"])
        .order("created_at", { ascending: false });

      const now = Date.now();
      const valid = (groups ?? []).find(
        (g) => !g.ends_at || new Date(g.ends_at as string).getTime() > now,
      );
      if (!valid) return null;

      return {
        id: valid.id as string,
        code: valid.code as string,
        status: valid.status as string,
        isHost: valid.creator_id === context.userId,
      };
    },
  );



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
    // Nothing may keep holding this user's Cx Coins afterwards.
    await supabaseAdmin
      .rpc("release_stale_commitments", { _user_id: context.userId })
      .then(() => undefined, () => undefined);
    return { ok: true };
  });

/**
 * Leave a waiting room that hasn't started yet: the seat is freed and the hold
 * released with no penalty, so the user can create or join another group.
 */
export const leaveLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("leave_study_lobby", {
      _user_id: context.userId,
      _group_id: data.id,
    });
    if (error) throw new Error(error.message || "Could not leave the group.");
    return { ok: true };
  });
