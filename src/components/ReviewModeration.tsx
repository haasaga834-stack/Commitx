import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveStudentReview,
  deleteStudentReview,
  editStudentReview,
  listAdminStudentReviews,
  rejectStudentReview,
  type AdminStudentReviewDTO,
  type ReviewStatus,
} from "@/lib/student-reviews.functions";
import { cn } from "@/lib/utils";

const statusClass: Record<ReviewStatus, string> = {
  pending: "border-primary/20 bg-primary/10 text-primary",
  approved: "border-primary/20 bg-primary/10 text-primary",
  rejected: "border-muted bg-muted text-muted-foreground",
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function editableFrom(review: AdminStudentReviewDTO) {
  return {
    displayName: review.displayName,
    courseYear: review.courseYear ?? "",
    review: review.review,
  };
}

export function ReviewModeration() {
  const loadReviews = useServerFn(listAdminStudentReviews);
  const approveReview = useServerFn(approveStudentReview);
  const rejectReview = useServerFn(rejectStudentReview);
  const saveReview = useServerFn(editStudentReview);
  const removeReview = useServerFn(deleteStudentReview);

  const [reviews, setReviews] = useState<AdminStudentReviewDTO[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState({ displayName: "", courseYear: "", review: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const result = await loadReviews({});
      setIsAdmin(result.isAdmin);
      setReviews(result.reviews);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load reviews.";
      if (!message.toLowerCase().includes("admin access")) setError(message);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (!isAdmin) return null;

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    try {
      setBusyId(id);
      setError(null);
      await action();
      setConfirmDeleteId(null);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const startEditing = (review: AdminStudentReviewDTO) => {
    setConfirmDeleteId(null);
    setEditingId(review.id);
    setEditing(editableFrom(review));
  };

  const saveEditing = (id: string) =>
    runAction(id, () =>
      saveReview({
        data: {
          id,
          displayName: editing.displayName,
          courseYear: editing.courseYear,
          review: editing.review,
        },
      }),
    );

  return (
    <section className="mx-6 mb-8 mt-6 rounded-[28px] border border-hairline bg-card/85 p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Admin
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Student reviews</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Approve, reject, edit, or delete submissions before they appear publicly.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={busyId !== null}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-background/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Review</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length ? (
              reviews.map((review) => {
                const isEditing = editingId === review.id;
                const deleting = confirmDeleteId === review.id;
                return (
                  <TableRow key={review.id}>
                    <TableCell className="min-w-[260px] align-top">
                      {isEditing ? (
                        <div className="space-y-2 py-2">
                          <Input
                            value={editing.displayName}
                            maxLength={60}
                            onChange={(event) => setEditing((prev) => ({ ...prev, displayName: event.target.value }))}
                            placeholder="Display name"
                          />
                          <Input
                            value={editing.courseYear}
                            maxLength={80}
                            onChange={(event) => setEditing((prev) => ({ ...prev, courseYear: event.target.value }))}
                            placeholder="Course/year"
                          />
                          <Textarea
                            value={editing.review}
                            maxLength={500}
                            rows={4}
                            onChange={(event) => setEditing((prev) => ({ ...prev, review: event.target.value }))}
                            placeholder="Review"
                          />
                        </div>
                      ) : (
                        <div className="py-2">
                          <p className="font-semibold text-foreground">{review.displayName}</p>
                          {review.courseYear ? <p className="text-xs text-muted-foreground">{review.courseYear}</p> : null}
                          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{review.review}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={cn("capitalize", statusClass[review.status])}>
                        {review.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap align-top text-sm text-muted-foreground">
                      {dateLabel(review.submittedAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button type="button" size="sm" onClick={() => void saveEditing(review.id)} disabled={busyId === review.id}>
                              Save
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={busyId === review.id}>
                              Cancel
                            </Button>
                          </>
                        ) : deleting ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => void runAction(review.id, () => removeReview({ data: { id: review.id } }))}
                              disabled={busyId === review.id}
                            >
                              Delete
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={busyId === review.id}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label="Approve review"
                              onClick={() => void runAction(review.id, () => approveReview({ data: { id: review.id } }))}
                              disabled={busyId === review.id || review.status === "approved"}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label="Reject review"
                              onClick={() => void runAction(review.id, () => rejectReview({ data: { id: review.id } }))}
                              disabled={busyId === review.id || review.status === "rejected"}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label="Edit review"
                              onClick={() => startEditing(review)}
                              disabled={busyId === review.id}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label="Delete review"
                              onClick={() => {
                                setEditingId(null);
                                setConfirmDeleteId(review.id);
                              }}
                              disabled={busyId === review.id}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No student reviews submitted yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
