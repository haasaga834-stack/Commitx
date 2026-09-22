import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listApprovedStudentReviews,
  submitStudentReview,
  type StudentReviewDTO,
} from "@/lib/student-reviews.functions";
import { cn } from "@/lib/utils";

const DISPLAY_NAME_LIMIT = 60;
const COURSE_YEAR_LIMIT = 80;
const REVIEW_LIMIT = 500;

type FormState = {
  displayName: string;
  courseYear: string;
  review: string;
};

const initialForm: FormState = {
  displayName: "",
  courseYear: "",
  review: "",
};

function formatReviewDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function validateForm(form: FormState) {
  const displayName = form.displayName.trim();
  const courseYear = form.courseYear.trim();
  const review = form.review.trim();

  if (!displayName) return "Enter a display name.";
  if (displayName.length > DISPLAY_NAME_LIMIT) return `Display name must be ${DISPLAY_NAME_LIMIT} characters or fewer.`;
  if (courseYear.length > COURSE_YEAR_LIMIT) return `Course/year must be ${COURSE_YEAR_LIMIT} characters or fewer.`;
  if (review.length < 20) return "Write at least 20 characters about your experience.";
  if (review.length > REVIEW_LIMIT) return `Review must be ${REVIEW_LIMIT} characters or fewer.`;
  return null;
}

const REVIEW_SCROLL_MAX = 168;

export function LandingReviews() {
  const loadReviews = useServerFn(listApprovedStudentReviews);
  const submitReview = useServerFn(submitStudentReview);
  const [reviews, setReviews] = useState<StudentReviewDTO[]>([]);
  const [active, setActive] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadReviews({})
      .then((rows) => {
        if (!alive) return;
        setReviews(rows);
        setActive(0);
      })
      .catch(() => {
        if (alive) setError("Reviews could not load right now.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadReviews]);

  const current = reviews[active] ?? null;
  const currentDate = useMemo(() => formatReviewDate(current?.publicAt ?? current?.submittedAt ?? null), [current]);
  const remaining = REVIEW_LIMIT - form.review.length;

  const move = (direction: -1 | 1) => {
    if (reviews.length < 2) return;
    setActive((index) => (index + direction + reviews.length) % reviews.length);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(false);
    const message = validateForm(form);
    if (message) {
      setError(message);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await submitReview({
        data: {
          displayName: form.displayName,
          courseYear: form.courseYear,
          review: form.review,
        },
      });
      setForm(initialForm);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="student-reviews" className="px-6 py-12 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
        <div className="rounded-[2rem] border border-ink-line bg-paper/78 p-5 shadow-[0_24px_80px_-48px_rgb(0_0_0/0.35)] backdrop-blur-xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/70">
                What students are saying
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Real experiences, reviewed before publishing.
              </h2>
            </div>
            <MessageCircle className="mt-1 h-6 w-6 flex-none text-primary/70" aria-hidden="true" />
          </div>

          <div className="min-h-[240px] rounded-[1.5rem] border border-ink-line bg-paper-soft/75 p-5 sm:p-6">
            {loading ? (
              <div className="flex h-full min-h-[190px] items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink-line border-t-primary" />
              </div>
            ) : current ? (
              <article className="flex min-h-[190px] flex-col justify-between gap-6">
                <div>
                  <div
                    className={cn(
                      "overflow-y-auto pr-1",
                      current.review.length > 180 &&
                        "[scrollbar-width:thin] max-h-[168px] overscroll-contain",
                    )}
                    style={current.review.length > 180 ? { maxHeight: REVIEW_SCROLL_MAX } : undefined}
                  >
                    <p className="text-lg leading-relaxed text-ink sm:text-xl">“{current.review}”</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-ink">{current.displayName}</p>
                    {current.courseYear ? (
                      <p className="mt-1 text-sm text-ink-soft">{current.courseYear}</p>
                    ) : null}
                  </div>
                  {currentDate ? <p className="text-xs font-medium text-ink-soft/70">{currentDate}</p> : null}
                </div>
              </article>
            ) : (
              <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 text-lg font-semibold text-ink">No approved reviews yet.</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">
                  Shared experiences appear here only after moderation.
                </p>
              </div>
            )}
          </div>

          {reviews.length > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {reviews.map((review, index) => (
                  <button
                    key={review.id}
                    type="button"
                    aria-label={`Show review ${index + 1}`}
                    onClick={() => setActive(index)}
                    className={cn(
                      "h-2.5 rounded-full transition-all",
                      active === index ? "w-8 bg-primary" : "w-2.5 bg-ink-line hover:bg-ink-soft/30",
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => move(-1)} aria-label="Previous review">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => move(1)} aria-label="Next review">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[2rem] border border-ink-line bg-paper-soft/70 p-5 shadow-[0_24px_80px_-52px_rgb(0_0_0/0.35)] sm:p-7"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/70">
            Share your experience
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Add a short review</h3>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-ink-soft">
              Display name
              <Input
                value={form.displayName}
                maxLength={DISPLAY_NAME_LIMIT}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                className="mt-2 bg-paper/80"
                placeholder="Your name"
              />
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              Course/year <span className="font-normal text-ink-soft/70">optional</span>
              <Input
                value={form.courseYear}
                maxLength={COURSE_YEAR_LIMIT}
                onChange={(event) => setForm((prev) => ({ ...prev, courseYear: event.target.value }))}
                className="mt-2 bg-paper/80"
                placeholder="Class 12, B.Tech 2nd year"
              />
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              Review
              <Textarea
                value={form.review}
                maxLength={REVIEW_LIMIT}
                rows={5}
                onChange={(event) => setForm((prev) => ({ ...prev, review: event.target.value }))}
                className="mt-2 resize-none bg-paper/80"
                placeholder="What changed in your study routine?"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-soft/70">
            <span>Reviewed before publishing.</span>
            <span>{remaining} left</span>
          </div>
          {error ? <p className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}
          {submitted ? (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Thanks — your review is pending approval.
            </p>
          ) : null}
          <Button type="submit" className="mt-6 w-full rounded-full" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit review"}
          </Button>
        </form>
      </div>
    </section>
  );
}
