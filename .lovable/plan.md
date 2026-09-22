# Plan: CommitX website content sections and reviews

## What will be added
- Add a small public **What students are saying** section to the existing homepage/content area without changing the hero or core sections.
- Show one approved student review at a time.
- If there are no approved reviews, show a clean empty state instead of fake reviews.
- Add a **Share your experience** form with:
  - Display name
  - Course/year, optional
  - Review text
- Store submitted reviews as **pending** so they never become public automatically.
- Add a compact **Why CommitX** section with realistic, non-exaggerated wording.
- Add a compact FAQ matching current CommitX functionality.

## Moderation
- Add a protected admin moderation surface where an admin can:
  - Approve pending reviews
  - Reject reviews
  - Edit review content
  - Delete reviews
- Use a proper backend role check instead of client-only flags.

## Technical details
- Add a `student_reviews` table with review status, content fields, timestamps, and RLS/grants.
- Add a separate `user_roles` table and `has_role` function if the project does not already have them, following the existing security rules.
- Add server functions for public approved-review reads, public pending-review submission, and authenticated admin moderation.
- Wire the homepage to the new review data and form.
- Add a small admin-only review manager in the existing settings area or a protected admin route, without changing public navigation.
- Keep existing session, auth, Cx Coins, Focus Class, Group Study, and landing hero behavior unchanged.

## Verification
- Check that public visitors can submit a review and it remains pending.
- Check that pending reviews do not show publicly.
- Check that approved reviews show one at a time.
- Check that moderation actions require an authenticated admin.
