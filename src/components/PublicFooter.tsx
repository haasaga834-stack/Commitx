import { Link } from "@tanstack/react-router";

export const SUPPORT_EMAIL = "commitx07@gmail.com";

export function PublicFooter() {
  return (
    <footer className="mt-10 border-t border-hairline bg-card/30 px-6 py-6 text-center text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/privacy-policy"
          className="transition-colors hover:text-foreground"
        >
          Privacy Policy
        </Link>
        <span aria-hidden="true" className="h-3 w-px bg-hairline" />
        <Link to="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
        <span aria-hidden="true" className="h-3 w-px bg-hairline" />
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="transition-colors hover:text-foreground"
        >
          Contact
        </a>
      </div>
      <p className="mt-4">
        Questions? Email us at{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="mt-2">© {new Date().getFullYear()} CommitX. All rights reserved.</p>
    </footer>
  );
}
