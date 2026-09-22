import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface StudentReviewDTO {
  id: string;
  displayName: string;
  courseYear: string | null;
  review: string;
  submittedAt: string;
  publicAt: string | null;
}

export interface AdminStudentReviewDTO extends StudentReviewDTO {
  status: ReviewStatus;
  reviewedAt: string | null;
  updatedAt: string;
}

const DISPLAY_NAME_LIMIT = 60;
const COURSE_YEAR_LIMIT = 80;
const REVIEW_LIMIT = 500;

const reviewInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name.")
    .max(DISPLAY_NAME_LIMIT, `Display name must be ${DISPLAY_NAME_LIMIT} characters or fewer.`),
  courseYear: z
    .string()
    .trim()
    .max(COURSE_YEAR_LIMIT, `Course/year must be ${COURSE_YEAR_LIMIT} characters or fewer.`)
    .optional()
    .transform((value) => (value ? value : null)),
  review: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters.")
    .max(REVIEW_LIMIT, `Review must be ${REVIEW_LIMIT} characters or fewer.`),
});

const adminEditSchema = reviewInputSchema.extend({
  id: z.string().uuid(),
});

const idSchema = z.object({ id: z.string().uuid() });

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createServerPublicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured.");
  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createSupabaseFetch(key),
    },
  });
}

function toPublicReview(row: {
  id: string;
  display_name: string;
  course_year: string | null;
  review: string;
  submitted_at: string;
  public_at: string | null;
}): StudentReviewDTO {
  return {
    id: row.id,
    displayName: row.display_name,
    courseYear: row.course_year,
    review: row.review,
    submittedAt: row.submitted_at,
    publicAt: row.public_at,
  };
}

function toAdminReview(row: {
  id: string;
  display_name: string;
  course_year: string | null;
  review: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  updated_at: string;
  public_at: string | null;
}): AdminStudentReviewDTO {
  return {
    ...toPublicReview(row),
    status: row.status as ReviewStatus,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

async function readBearerUserId(): Promise<string | null> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) throw new Error("Invalid session.");
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  if (token.split(".").length !== 3) throw new Error("Invalid session.");

  const supabasePublic = createServerPublicClient();
  const { data, error } = await supabasePublic.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Invalid session.");
  return data.claims.sub;
}

async function ensureAdmin(context: { supabase: ReturnType<typeof createServerPublicClient>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admin access required.");
}

export const listApprovedStudentReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<StudentReviewDTO[]> => {
    const supabasePublic = createServerPublicClient();
    const { data, error } = await supabasePublic
      .from("student_reviews")
      .select("id, display_name, course_year, review, submitted_at, public_at")
      .eq("status", "approved")
      .order("public_at", { ascending: false, nullsFirst: false })
      .order("submitted_at", { ascending: false })
      .limit(12);

    if (error) throw new Error("Unable to load student reviews.");
    return (data ?? []).map(toPublicReview);
  },
);

export const submitStudentReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reviewInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const submittedBy = await readBearerUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("student_reviews").insert({
      display_name: data.displayName,
      course_year: data.courseYear,
      review: data.review,
      status: "pending",
      submitted_by: submittedBy,
      reviewed_at: null,
      reviewed_by: null,
      public_at: null,
    });

    if (error) throw new Error("Could not submit your review.");
    return { ok: true as const };
  });

export const listAdminStudentReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; reviews: AdminStudentReviewDTO[] }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("student_reviews")
      .select("id, display_name, course_year, review, status, submitted_at, reviewed_at, updated_at, public_at")
      .order("submitted_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("Unable to load reviews.");
    return { isAdmin: true, reviews: (data ?? []).map(toAdminReview) };
  });

export const editStudentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminEditSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("student_reviews")
      .update({
        display_name: data.displayName,
        course_year: data.courseYear,
        review: data.review,
      })
      .eq("id", data.id);

    if (error) throw new Error("Could not update review.");
    return { ok: true as const };
  });

export const approveStudentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("student_reviews")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        public_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) throw new Error("Could not approve review.");
    return { ok: true as const };
  });

export const rejectStudentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("student_reviews")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        public_at: null,
      })
      .eq("id", data.id);

    if (error) throw new Error("Could not reject review.");
    return { ok: true as const };
  });

export const deleteStudentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("student_reviews").delete().eq("id", data.id);

    if (error) throw new Error("Could not delete review.");
    return { ok: true as const };
  });
