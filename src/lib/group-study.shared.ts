/* Shared, browser-safe pieces of the Group Study feature. */

/** Creator + 4 friends. */
export const MAX_GROUP_SIZE = 5;

export interface GroupDTO {
  id: string;
  code: string;
  goal: string;
  duration_minutes: number;
  commit_value: number;
  mode: "standard" | "verified";
  status: "lobby" | "active" | "ended";
  /** Host's chosen ambience theme, shared by every participant. */
  theme?: string | null;
  started_at: string | null;
  ends_at: string | null;
  creator_id: string;
}

export interface GroupMemberDTO {
  user_id: string;
  display_name: string;
  role: string;
  status: "committed" | "joined" | "completed" | "failed" | "left";
  joined_at: string | null;
}

export interface GroupStateDTO {
  group: GroupDTO;
  members: GroupMemberDTO[];
  serverNow: number;
  isCreator: boolean;
  me: GroupMemberDTO | null;
}

export interface InvitePreviewDTO {
  id: string;
  goal: string;
  duration_minutes: number;
  commit_value: number;
  mode: "standard" | "verified";
  status: string;
  creator_name: string;
  member_count: number;
  full: boolean;
  already_member: boolean;
}

/** Human-friendly invite code (no ambiguous characters). */
export function makeGroupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function displayNameFor(
  client: { from: (t: string) => any },
  userId: string,
): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | undefined) || "Friend";
}
